import { NextResponse } from 'next/server';
import { calculateRRGData } from '@/lib/rrgMath';
import { getChartQuotesWithFallback } from '@/lib/yfCache';
import { logger } from '@/lib/logger';

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

    logger.info(`Benchmark: ${benchmarkData.length} quotes, Sectors: ${sectorsData.filter(d => d.length > 0).length}/${SECTORS.length}`);

    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    const results = SECTORS.map((sector, index) => {
        const data = sectorsData[index];
        if (!data || data.length < 5) return null; 

        const closes = data.map((d: any) => d.close);
        const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

        if (!fullHistory || fullHistory.length === 0) return null;

        const head = fullHistory[fullHistory.length - 1];
        // Tail should include last 10 points before the head
        const tail = fullHistory.slice(Math.max(0, fullHistory.length - 11), fullHistory.length - 1);

        return {
          name: sector.name,
          head, 
          tail
        };
    }).filter(r => r !== null);

    return NextResponse.json({ 
      timestamp: new Date().toISOString(),
      config: { interval, rsWindow, rocWindow, backtestDate: dateParam || 'Live' },
      cacheHit: !refreshParam,
      sectors: results
    });

  } catch (error: any) {
    logger.error('Market data API error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}