import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { calculateRRGData } from '@/lib/rrgMath';
import { SECTOR_CONSTITUENTS } from '@/lib/sectorConfig';

const yahooFinance = new YahooFinance({
  suppressNotices: ['ripHistorical', 'yahooSurvey'],
  validation: {
    logErrors: false,
    logOptionsErrors: false
  }
});

// Retry logic for Yahoo Finance API
async function fetchWithRetry(symbol: string, options: any, retries = 2): Promise<any[]> {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`[fetchWithRetry] Attempt ${i+1} for ${symbol}`);
      const result: any = await yahooFinance.chart(symbol, options);
      console.log(`[fetchWithRetry] Success for ${symbol}, got ${result.quotes?.length || 0} quotes`);
      return result.quotes || [];
    } catch (error: any) {
      console.error(`[fetchWithRetry] Error for ${symbol} on attempt ${i+1}:`, error.message || error);
      // If it's a validation error, try to return the data anyway if available
      if (error.result?.quotes) {
        console.log(`[fetchWithRetry] Validation failed but data available for ${symbol}, using it anyway`);
        return error.result.quotes;
      }
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return [];
}

// Helper: Check if a date string is today
function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
}

// Helper: Merge intraday latest close into daily data for today
async function enhanceDataWithIntraday(dailyQuotes: any[], symbol: string, endDateStr: string): Promise<any[]> {
  // Only enhance if we're querying for today
  if (!isToday(endDateStr)) {
    return dailyQuotes;
  }
  
  try {
    // Fetch intraday data for today
    const intradayQuotes = await fetchWithRetry(symbol, {
      period1: endDateStr,
      period2: endDateStr,
      interval: '1m'
    }, 1);
    
    if (intradayQuotes.length > 0) {
      const latestIntraday = intradayQuotes[intradayQuotes.length - 1];
      const lastDailyQuote = dailyQuotes[dailyQuotes.length - 1];
      
      // Check if last daily quote is from today
      if (lastDailyQuote && isToday(lastDailyQuote.date)) {
        // Replace today's close with latest intraday close
        return [
          ...dailyQuotes.slice(0, -1),
          {
            ...lastDailyQuote,
            close: latestIntraday.close,
            high: Math.max(lastDailyQuote.high || latestIntraday.close, latestIntraday.high || latestIntraday.close),
            low: Math.min(lastDailyQuote.low || latestIntraday.close, latestIntraday.low || latestIntraday.close),
            lastUpdate: 'intraday'
          }
        ];
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch intraday for ${symbol}:`, err);
  }
  
  return dailyQuotes;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectorSymbol = searchParams.get('sector') || '^NSEBANK';
    const interval = (searchParams.get('interval') || '1d') as '1d' | '1wk' | '1mo';
    const rsWindow = parseInt(searchParams.get('rsWindow') || '14');
    const rocWindow = parseInt(searchParams.get('rocWindow') || '14');
    const dateParam = searchParams.get('date');
    const benchmarkParam = searchParams.get('benchmark') || 'sector'; // 'sector' or 'nifty'

    console.log(`[API] Received request - sector: ${sectorSymbol}, interval: ${interval}, rsWindow: ${rsWindow}, rocWindow: ${rocWindow}, dateParam: ${dateParam}`);

    // Get sector info
    const sectorInfo = SECTOR_CONSTITUENTS[sectorSymbol];
    if (!sectorInfo) {
      return NextResponse.json({ error: 'Sector not found' }, { status: 404 });
    }

    // Calculate date range
    let endDate = dateParam ? new Date(dateParam) : new Date();
    let startDate = new Date(endDate);
    
    if (interval === '1d') {
      startDate.setFullYear(startDate.getFullYear() - 2);
    } else if (interval === '1wk') {
      startDate.setFullYear(startDate.getFullYear() - 5);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 10);
    }

    const queryOptions = {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: interval
    };

    const endDateStr = endDate.toISOString().split('T')[0];

    // Determine benchmark to use
    const benchmarkSymbol = benchmarkParam === 'nifty' ? '^NSEI' : sectorSymbol;
    const benchmarkName = benchmarkParam === 'nifty' ? 'NIFTY 50' : sectorInfo.name;

    // Fetch benchmark data
    console.log(`[API] Fetching benchmark: ${benchmarkSymbol} with options:`, queryOptions);
    let benchmarkData = await fetchWithRetry(benchmarkSymbol, queryOptions);
    if (!benchmarkData || benchmarkData.length === 0) {
      console.error(`[API] No data returned for benchmark ${benchmarkSymbol}`);
      throw new Error(`Failed to fetch benchmark data for ${benchmarkSymbol}`);
    }
    console.log(`[API] Benchmark ${benchmarkSymbol} fetched successfully, ${benchmarkData.length} data points`);
    
    // Enhance benchmark with intraday data for today (only if NOT backtesting)
    if (!dateParam) {
      benchmarkData = await enhanceDataWithIntraday(benchmarkData, benchmarkSymbol, endDateStr);
    }
    
    // Debug: log what date range we got back
    const lastBenchmarkQuote = benchmarkData[benchmarkData.length - 1];
    console.log('[API] Sector-Stocks Debug:', {
      queryPeriod: { period1: queryOptions.period1, period2: queryOptions.period2 },
      lastQuoteDate: lastBenchmarkQuote?.date,
      lastQuoteTime: lastBenchmarkQuote?.datetime,
      dataSource: lastBenchmarkQuote?.lastUpdate || 'daily',
      totalQuotes: benchmarkData.length,
      today: new Date().toISOString().split('T')[0],
      isToday: isToday(endDateStr),
      daysFromToday: lastBenchmarkQuote?.date ? 
        Math.floor((new Date().getTime() - new Date(lastBenchmarkQuote.date).getTime()) / (1000*60*60*24)) : 'N/A'
    });
    
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    // Fetch all constituent stocks with individual error handling
    // Use staggered fetching to avoid rate limiting (batches of 3 with 200ms delay)
    console.log(`[API] Fetching ${sectorInfo.stocks.length} stocks for sector ${sectorInfo.name}:`, sectorInfo.stocks);
    let stocksData: any[] = [];
    const batchSize = 3;
    
    for (let i = 0; i < sectorInfo.stocks.length; i += batchSize) {
      const batch = sectorInfo.stocks.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(stock => fetchWithRetry(stock, queryOptions))
      );
      
      // Enhance each stock with intraday data for today (only if NOT backtesting, preserve PromiseSettledResult structure)
      if (!dateParam) {
        const enhancedResults = await Promise.all(
          batchResults.map(async (result, idx) => {
            if (result.status === 'fulfilled') {
              const enhancedData = await enhanceDataWithIntraday(result.value, batch[idx], endDateStr);
              return { status: 'fulfilled' as const, value: enhancedData };
            }
            return result;
          })
        );
        stocksData.push(...enhancedResults);
      } else {
        stocksData.push(...batchResults);
      }
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < sectorInfo.stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Calculate RRG for each stock vs sector index
    const results = sectorInfo.stocks.map((stock, index) => {
      const stockResult = stocksData[index];
      
      // Skip if fetch failed
      if (stockResult.status === 'rejected') {
        console.warn(`[API] Failed to fetch ${stock}:`, stockResult.reason);
        return null;
      }
      
      const data = stockResult.value;
      if (!data || data.length < 5) {
        console.warn(`[API] Insufficient data for ${stock}: ${data?.length || 0} data points`);
        return null;
      }

      const closes = data.map((d: any) => d.close);
      const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

      if (!fullHistory || fullHistory.length === 0) {
        console.warn(`[API] RRG calculation failed for ${stock}`);
        return null;
      }

      // head is the current/last point
      const head = fullHistory[fullHistory.length - 1];
      
      // tail is historical data BEFORE the head (excluding head), at least 2 points for day-over-day comparison
      const tailLength = Math.max(2, rsWindow);
      const tail = fullHistory.slice(Math.max(0, fullHistory.length - tailLength - 1), fullHistory.length - 1);

      console.log(`[API] Successfully processed ${stock}, fullHistory length: ${fullHistory.length}, tail length: ${tail.length}, tail[-2]: {x: ${tail[tail.length - 2]?.x}, y: ${tail[tail.length - 2]?.y}}, tail[-1]: {x: ${tail[tail.length - 1]?.x}, y: ${tail[tail.length - 1]?.y}}`);
      return {
        name: stock.replace('.NS', ''),
        symbol: stock,
        head,
        tail
      };
    }).filter(r => r !== null);

    console.log(`[API] Successfully processed ${results.length} out of ${sectorInfo.stocks.length} stocks`);

    // If no stocks were successfully fetched, return error
    if (results.length === 0) {
      console.error(`[API] No stocks could be fetched for sector ${sectorInfo.name}`);
      return NextResponse.json({ 
        error: 'No stocks could be fetched for this sector',
        sector: sectorInfo.name
      }, { status: 500 });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      config: { interval, rsWindow, rocWindow, backtestDate: dateParam || 'Live' },
      sector: sectorInfo.name,
      sectorSymbol,
      stocks: results
    });

  } catch (error: any) {
    console.error('Sector stocks API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
