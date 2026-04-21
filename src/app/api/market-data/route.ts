import { NextResponse } from 'next/server';
import { calculateRRGData } from '@/lib/rrgMath';
import { getChartQuotesWithFallback } from '@/lib/yfCache';
import { logger } from '@/lib/logger';
import { calculateSectorMlFeatures, toFeatureVector } from '@/lib/ml/featureCalc';
import { getSectorIntelligence, warmupSectorModels } from '@/lib/ml/onnxEngine';
import { calculateSectorPrimarySnapshot, toPrimaryFeatureVector, rankPercentileValue } from '@/lib/ml/sectorSignalFeatures';

export const runtime = 'nodejs';

const SECTORS = [
  { symbol: '^CNXIT', name: 'IT' },
  { symbol: '^NSEBANK', name: 'Bank' },
  { symbol: '^CNXAUTO', name: 'Auto' },
  { symbol: '^CNXMETAL', name: 'Metal' },
  { symbol: '^CNXFMCG', name: 'FMCG' },
  { symbol: '^CNXREALTY', name: 'Realty' },
  { symbol: '^CNXPSUBANK', name: 'PSU Bank' },
  { symbol: '^CNXENERGY', name: 'Energy' },
  { symbol: '^CNXINFRA', name: 'Infra' }, 
  { symbol: '^CNXPHARMA', name: 'Pharma' },
  { symbol: 'NIFTY_FIN_SERVICE.NS', name: 'Fin Serv' },
  { symbol: '^NSMIDCP', name: 'Next 50' },
];

const BENCHMARK = '^NSEI';

const percentileRank = (value: number, series: number[]) => rankPercentileValue(value, series);

async function fetchWithRetry(symbol: string, period1: Date, period2: Date, interval: '1d' | '1wk' | '1mo', forceRefresh: boolean = false): Promise<any[]> {
  for (let i = 0; i < 2; i++) {
    try {
      const quotes = await getChartQuotesWithFallback(symbol, period1, period2, interval, { forceRefresh });
      return quotes.filter((q: any) => q.close !== null && q.close !== undefined);
    } catch (err) {
      if (i === 1) {
        logger.warn(`Failed to fetch ${symbol}`);
        return [];
      } 
      await new Promise(r => setTimeout(r, 1000)); 
    }
  }
  return [];
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const intervalParam = searchParams.get('interval');
    const rsWindowParam = searchParams.get('rsWindow');
    const rocWindowParam = searchParams.get('rocWindow');
    const dateParam = searchParams.get('date');
    const refreshParam = searchParams.get('refresh') === 'true'; // Allow manual refresh

    const interval: '1d' | '1wk' | '1mo' = (intervalParam === '1d' || intervalParam === '1wk' || intervalParam === '1mo') ? intervalParam : '1wk';
    const rsWindow = rsWindowParam ? Math.max(parseInt(rsWindowParam) || 14, 5) : 14; 
    const rocWindow = rocWindowParam ? Math.max(parseInt(rocWindowParam) || 1, 1) : 1;

    const endDate = dateParam ? new Date(dateParam) : new Date();
    const startDate = new Date(endDate);
    
    if (interval === '1d') startDate.setDate(endDate.getDate() - 730); 
    else if (interval === '1wk') startDate.setDate(endDate.getDate() - 1825);
    else if (interval === '1mo') startDate.setDate(endDate.getDate() - 3650);

    logger.info(`Market-Data API: interval=${interval}, refresh=${refreshParam}, backtestDate=${dateParam || 'live'}`);

    // Keep first invocation snappy by triggering model load in parallel with quote fetches.
    const warmupPromise = warmupSectorModels().catch((error) => {
      const message = error?.message || String(error);
      logger.warn(`ONNX warmup failed: ${message}`);
      console.warn(`[ML][warmup][failed] ${message}`);
      return null;
    });

    // Fetch benchmark
    let benchmarkData = await fetchWithRetry(BENCHMARK, startDate, endDate, interval, refreshParam);
    
    // Fetch sectors sequentially with delay to avoid rate limits
    const sectorsData: any[] = [];
    for (const sector of SECTORS) {
      const data = await fetchWithRetry(sector.symbol, startDate, endDate, interval, refreshParam);
      sectorsData.push(data);
      await new Promise(r => setTimeout(r, 300)); // 300ms delay between sectors
    }

    if (!benchmarkData || benchmarkData.length === 0) {
      logger.error('Benchmark fetch failed');
      return NextResponse.json({ error: 'Failed to fetch benchmark data' }, { status: 500 });
    }

    await warmupPromise;

    logger.info(`Benchmark: ${benchmarkData.length} quotes, Sectors: ${sectorsData.filter(d => d.length > 0).length}/${SECTORS.length}`);

    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    const snapshots = (
      await Promise.all(
        SECTORS.map(async (sector, index) => {
          const data = sectorsData[index];
          if (!data || data.length < 5) return null;

          const closes = data.map((d: any) => d.close);
          const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

          if (!fullHistory || fullHistory.length === 0) return null;

          const head = fullHistory[fullHistory.length - 1];
          const tail = fullHistory.slice(Math.max(0, fullHistory.length - 11), fullHistory.length - 1);

          const legacySnapshot = calculateSectorMlFeatures(closes, benchmarkCloses);
          const primarySnapshot = calculateSectorPrimarySnapshot(closes, benchmarkCloses);

          return {
            name: sector.name,
            head,
            tail,
            legacySnapshot,
            primarySnapshot,
          };
        })
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    const primarySnapshots = snapshots
      .map((item) => item.primarySnapshot)
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null);

    const rankValues = {
      rsRatio: primarySnapshots.map((snapshot) => snapshot.RS_Ratio),
      rsMomentum: primarySnapshots.map((snapshot) => snapshot.RS_Momentum),
      excessRet20d: primarySnapshots.map((snapshot) => snapshot.Excess_Ret_20d),
      vol20d: primarySnapshots.map((snapshot) => snapshot.Vol_20d),
    };

    const results = [] as Array<any>;
    let mlOkCount = 0;
    let mlFailedCount = 0;
    let mlSkippedCount = 0;

    for (const item of snapshots) {
      let mlInsights = null;
      let mlStatus: { status: 'ok' | 'failed' | 'skipped'; reason: string } = {
        status: 'skipped',
        reason: 'Snapshot unavailable for ML inference',
      };

      try {
        if (item.primarySnapshot && item.legacySnapshot) {
          const primaryFeatures = toPrimaryFeatureVector(item.primarySnapshot, {
            Rank_RS_Ratio: percentileRank(item.primarySnapshot.RS_Ratio, rankValues.rsRatio),
            Rank_RS_Momentum: percentileRank(item.primarySnapshot.RS_Momentum, rankValues.rsMomentum),
            Rank_Excess_Ret_20d: percentileRank(item.primarySnapshot.Excess_Ret_20d, rankValues.excessRet20d),
            Rank_Vol_20d: percentileRank(item.primarySnapshot.Vol_20d, rankValues.vol20d),
          });

          const legacyFeatures = toFeatureVector(item.legacySnapshot);
          const intelligence = await getSectorIntelligence({
            primaryFeatures,
            legacyFeatures,
          });

          mlInsights = {
            ...intelligence,
            primaryFeatures,
            legacyFeatures,
          };

          mlStatus = {
            status: 'ok',
            reason: 'Inference completed',
          };
          mlOkCount += 1;
        } else {
          mlSkippedCount += 1;
        }
      } catch (error: any) {
        const message = error?.message || String(error);
        logger.warn(`ML inference failed for ${item.name}: ${message}`);
        console.warn(`[ML][inference][failed] sector=${item.name} reason=${message}`);
        mlStatus = {
          status: 'failed',
          reason: message,
        };
        mlFailedCount += 1;
      }

      results.push({
        name: item.name,
        head: item.head,
        tail: item.tail,
        ml: mlInsights,
        mlStatus,
      });
    }

    console.info(`[ML][summary] ok=${mlOkCount} failed=${mlFailedCount} skipped=${mlSkippedCount} total=${results.length}`);

    return NextResponse.json({ 
      timestamp: new Date().toISOString(),
      config: { interval, rsWindow, rocWindow, backtestDate: dateParam || 'Live' },
      cacheHit: !refreshParam,
      mlDiagnostics: {
        ok: mlOkCount,
        failed: mlFailedCount,
        skipped: mlSkippedCount,
        total: results.length,
      },
      sectors: results
    });

  } catch (error: any) {
    logger.error('Market data API error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}