import { NextRequest, NextResponse } from 'next/server';
import { calculateRRGData } from '@/lib/rrgMath';
import { SECTOR_CONSTITUENTS } from '@/lib/sectorConfig';
import { getChartQuotesWithFallback } from '@/lib/yfCache';
import { logger } from '@/lib/logger';

// Retry logic with cache
async function fetchWithRetry(symbol: string, period1: Date, period2: Date, interval: '1d' | '1wk' | '1mo', forceRefresh: boolean = false, retries = 2): Promise<any[]> {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await getChartQuotesWithFallback(symbol, period1, period2, interval, { forceRefresh });
      return result || [];
    } catch (error: any) {
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectorSymbol = searchParams.get('sector') || '^NSEBANK';
    const interval = (searchParams.get('interval') || '1d') as '1d' | '1wk' | '1mo';
    const rsWindow = parseInt(searchParams.get('rsWindow') || '14');
    const rocWindow = parseInt(searchParams.get('rocWindow') || '14');
    const dateParam = searchParams.get('date');
    const benchmarkParam = searchParams.get('benchmark') || 'sector';
    const refreshParam = searchParams.get('refresh') === 'true';

    const sectorInfo = SECTOR_CONSTITUENTS[sectorSymbol];
    if (!sectorInfo) {
      return NextResponse.json({ error: 'Sector not found' }, { status: 404 });
    }

    let endDate = dateParam ? new Date(dateParam) : new Date();
    let startDate = new Date(endDate);
    
    if (interval === '1d') {
      startDate.setFullYear(startDate.getFullYear() - 2);
    } else if (interval === '1wk') {
      startDate.setFullYear(startDate.getFullYear() - 5);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 10);
    }

    const benchmarkSymbol = benchmarkParam === 'nifty' ? '^NSEI' : sectorSymbol;
    const benchmarkName = benchmarkParam === 'nifty' ? 'NIFTY 50' : sectorInfo.name;

    logger.info(`Sector-Stocks API: sector=${sectorInfo.name}, refresh=${refreshParam}`);
    let benchmarkData = await fetchWithRetry(benchmarkSymbol, startDate, endDate, interval, refreshParam);
    
    if (!benchmarkData || benchmarkData.length === 0) {
      throw new Error(`Failed to fetch benchmark data for ${benchmarkSymbol}`);
    }
    
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    // Fetch stocks in batches with delays
    logger.info(`Fetching ${sectorInfo.stocks.length} stocks for ${sectorInfo.name}`);
    let stocksData: any[] = [];
    const batchSize = 3;
    
    for (let i = 0; i < sectorInfo.stocks.length; i += batchSize) {
      const batch = sectorInfo.stocks.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(stock => fetchWithRetry(stock, startDate, endDate, interval, refreshParam))
      );
      stocksData.push(...batchResults);
      
      if (i + batchSize < sectorInfo.stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Calculate RRG for each stock
    const results = sectorInfo.stocks.map((stock, index) => {
      const stockResult = stocksData[index];
      
      if (stockResult.status === 'rejected') {
        logger.warn(`Failed to fetch ${stock}`);
        return null;
      }
      
      const data = stockResult.value;
      if (!data || data.length < 5) {
        return null;
      }

      const closes = data.map((d: any) => d.close);
      const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

      if (!fullHistory || fullHistory.length === 0) {
        return null;
      }

      const head = fullHistory[fullHistory.length - 1];
      const tailLength = Math.max(2, rsWindow);
      const tail = fullHistory.slice(Math.max(0, fullHistory.length - tailLength - 1), fullHistory.length - 1);

      return {
        name: stock.replace('.NS', ''),
        symbol: stock,
        head,
        tail
      };
    }).filter(r => r !== null);

    logger.info(`Successfully processed ${results.length}/${sectorInfo.stocks.length} stocks`);

    if (results.length === 0) {
      return NextResponse.json({ 
        error: 'No stocks could be fetched for this sector',
        sector: sectorInfo.name
      }, { status: 500 });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      config: { interval, rsWindow, rocWindow, backtestDate: dateParam || 'Live' },
      cacheHit: !refreshParam,
      sector: sectorInfo.name,
      sectorSymbol,
      stocks: results
    });

  } catch (error: any) {
    logger.error('Sector stocks API error:', error.message);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
