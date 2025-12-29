import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { calculateRRGData } from '@/lib/rrgMath';
import { supabase } from '@/lib/supabaseServer';

const yahooFinance = new YahooFinance({
  suppressNotices: ['ripHistorical', 'yahooSurvey'],
  validation: {
    logErrors: false,
    logOptionsErrors: false
  }
});

const BENCHMARK = '^NSEI';

async function fetchWithRetry(symbol: string, options: any, retries = 2): Promise<any[]> {
  for (let i = 0; i <= retries; i++) {
    try {
      const result: any = await yahooFinance.chart(symbol, options);
      return result.quotes || [];
    } catch (error: any) {
      if (error.result?.quotes) {
        return error.result.quotes;
      }
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = request.headers.get('x-user-id');
    const interval = (searchParams.get('interval') || '1d') as '1d' | '1wk' | '1mo';
    const rsWindow = parseInt(searchParams.get('rsWindow') || '14');
    const rocWindow = parseInt(searchParams.get('rocWindow') || '14');
    const dateParam = searchParams.get('date');

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Fetch user's custom lists
    const { data: customLists, error: listsError } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (listsError) {
      return NextResponse.json({ error: 'Failed to fetch custom lists', details: listsError.message }, { status: 500 });
    }

    if (!customLists || customLists.length === 0) {
      return NextResponse.json({ lists: [] });
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

    // Fetch benchmark data
    const benchmarkData = await fetchWithRetry(BENCHMARK, queryOptions);
    if (!benchmarkData || benchmarkData.length === 0) {
      throw new Error('Failed to fetch benchmark data');
    }
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    // Process each custom list
    const results = await Promise.all(
      customLists.map(async (list) => {
        try {
          // Ensure stocks have .NS suffix for Yahoo Finance
          const stockSymbols = list.stocks.map((stock: string) => 
            stock.endsWith('.NS') ? stock : `${stock}.NS`
          );

          // Fetch data for all stocks in the list
          const stockResults = await Promise.allSettled(
            stockSymbols.map((stock: string) => fetchWithRetry(stock, queryOptions))
          );

          // Calculate equal-weighted index price for each date
          const validStocksData = stockResults
            .map((result, idx) => {
              if (result.status === 'fulfilled' && result.value.length > 0) {
                return {
                  stock: stockSymbols[idx],
                  closes: result.value.map((d: any) => d.close)
                };
              }
              return null;
            })
            .filter((d): d is { stock: string; closes: number[] } => d !== null);

          if (validStocksData.length === 0) {
            console.warn(`No valid stock data for list: ${list.name}`);
            return null;
          }

          console.log(`Processing list "${list.name}" with ${validStocksData.length} valid stocks out of ${list.stocks.length}`);

          // Align data lengths and calculate equal-weighted index
          const minLength = Math.min(
            Math.min(...validStocksData.map(d => d.closes.length)),
            benchmarkCloses.length
          );

          if (minLength < 5) {
            console.warn(`Not enough data for list ${list.name}: minLength=${minLength}`);
            return null;
          }

          const indexPrices: (number | null)[] = [];
          for (let i = 0; i < minLength; i++) {
            const prices = validStocksData
              .map(d => d.closes[d.closes.length - minLength + i])
              .filter(p => p !== null && p !== undefined && !isNaN(p)) as number[];
            
            if (prices.length > 0) {
              indexPrices.push(prices.reduce((a, b) => a + b, 0) / prices.length);
            } else {
              indexPrices.push(null);
            }
          }

          // Calculate RRG data for the custom list index
          const validIndexPrices = indexPrices.filter(p => p !== null) as number[];
          const slicedBenchmark = benchmarkCloses.slice(-minLength);
          
          const fullHistory = calculateRRGData(validIndexPrices, slicedBenchmark, rsWindow, rocWindow);

          if (!fullHistory || fullHistory.length === 0) {
            return null;
          }

          const tailLength = Math.max(2, rsWindow);
          const tail = fullHistory.slice(-tailLength);

          console.log(`Successfully processed list "${list.name}": head=${JSON.stringify(fullHistory[fullHistory.length - 1])}`);

          return {
            id: list.id,
            name: list.name,
            stockCount: validStocksData.length,
            head: fullHistory[fullHistory.length - 1],
            tail: tail
          };
        } catch (error) {
          console.error(`Error processing custom list ${list.name}:`, error);
          return null;
        }
      })
    );

    const validResults = results.filter(r => r !== null);

    console.log(`Returning ${validResults.length} valid custom lists out of ${customLists.length}`);

    return NextResponse.json({ 
      lists: validResults,
      config: {
        interval,
        rsWindow,
        rocWindow
      }
    });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
