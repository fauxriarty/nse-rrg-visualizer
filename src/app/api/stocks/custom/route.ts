import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { calculateRRGData } from '@/lib/rrgMath';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

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
    const stocksParam = searchParams.get('stocks') || '';
    const interval = (searchParams.get('interval') || '1d') as '1d' | '1wk' | '1mo';
    const rsWindow = parseInt(searchParams.get('rsWindow') || '14');
    const rocWindow = parseInt(searchParams.get('rocWindow') || '14');
    const dateParam = searchParams.get('date');

    if (!stocksParam) {
      return NextResponse.json({ error: 'No stocks specified' }, { status: 400 });
    }

    // Parse stock symbols
    const stockSymbols = stocksParam.split(',').map(s => s.trim()).filter(s => s);

    if (stockSymbols.length === 0) {
      return NextResponse.json({ error: 'No valid stock symbols' }, { status: 400 });
    }

    // Read CSV to get full ticker symbols (add .NS suffix if needed)
    const csvPath = path.join(process.cwd(), 'data', 'stocks', 'all_stocks_latest.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records: any[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Map symbols to tickers
    const stockTickers = stockSymbols.map(symbol => {
      const stock = records.find((r: any) => r.symbol === symbol);
      return stock ? stock.ticker : `${symbol}.NS`;
    });

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

    // Fetch NIFTY 50 as benchmark (always)
    const benchmarkSymbol = '^NSEI';
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
    
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    // Fetch all stocks with individual error handling
    // Use staggered fetching to avoid rate limiting (batches of 3 with 200ms delay)
    console.log(`[API] Fetching ${stockTickers.length} stocks:`, stockTickers);
    let stocksData: any[] = [];
    const batchSize = 3;
    
    for (let i = 0; i < stockTickers.length; i += batchSize) {
      const batch = stockTickers.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(ticker => fetchWithRetry(ticker, queryOptions))
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
      if (i + batchSize < stockTickers.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Calculate RRG for each stock vs NIFTY 50
    const results = stockTickers.map((ticker, index) => {
      const stockResult = stocksData[index];
      const symbol = stockSymbols[index];
      
      // Skip if fetch failed
      if (stockResult.status === 'rejected') {
        console.warn(`[API] Failed to fetch ${ticker}:`, stockResult.reason);
        return null;
      }
      
      const data = stockResult.value;
      if (!data || data.length < 5) {
        console.warn(`[API] Insufficient data for ${ticker}: ${data?.length || 0} data points`);
        return null;
      }

      const closes = data.map((d: any) => d.close);
      const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

      if (!fullHistory || fullHistory.length === 0) {
        console.warn(`[API] RRG calculation failed for ${ticker}`);
        return null;
      }

      // head is the current/last point
      const head = fullHistory[fullHistory.length - 1];
      
      // tail is historical data BEFORE the head (excluding head), at least 2 points for day-over-day comparison
      const tailLength = Math.max(2, rsWindow);
      const tail = fullHistory.slice(Math.max(0, fullHistory.length - tailLength - 1), fullHistory.length - 1);

      console.log(`[API] Successfully processed ${ticker}`);
      return {
        name: symbol,
        symbol: ticker,
        head,
        tail
      };
    }).filter(r => r !== null);

    console.log(`[API] Successfully processed ${results.length} out of ${stockTickers.length} stocks`);

    // If no stocks were successfully fetched, return error
    if (results.length === 0) {
      console.error(`[API] No stocks could be fetched`);
      return NextResponse.json({ 
        error: 'No stocks could be fetched'
      }, { status: 500 });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      config: { interval, rsWindow, rocWindow, backtestDate: dateParam || 'Live' },
      benchmark: 'NIFTY 50',
      stocks: results
    });

  } catch (error: any) {
    console.error('Custom stocks API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
