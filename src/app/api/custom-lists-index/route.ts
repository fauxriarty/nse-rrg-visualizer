import { NextRequest, NextResponse } from 'next/server';
import { calculateRRGData } from '@/lib/rrgMath';
import { supabase } from '@/lib/supabaseServer';
import { getChartQuotesWithFallback } from '@/lib/yfCache';
import { logger } from '@/lib/logger';

const BENCHMARK = '^NSEI';

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
    const userId = request.headers.get('x-user-id');
    const interval = (searchParams.get('interval') || '1d') as '1d' | '1wk' | '1mo';
    const rsWindow = parseInt(searchParams.get('rsWindow') || '14');
    const rocWindow = parseInt(searchParams.get('rocWindow') || '14');
    const dateParam = searchParams.get('date');
    const refreshParam = searchParams.get('refresh') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

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

    let endDate = dateParam ? new Date(dateParam) : new Date();
    let startDate = new Date(endDate);
    
    if (interval === '1d') {
      startDate.setFullYear(startDate.getFullYear() - 2);
    } else if (interval === '1wk') {
      startDate.setFullYear(startDate.getFullYear() - 5);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 10);
    }

    logger.info(`Custom Lists API: ${customLists.length} lists, refresh=${refreshParam}`);

    const benchmarkData = await fetchWithRetry(BENCHMARK, startDate, endDate, interval, refreshParam);
    if (!benchmarkData || benchmarkData.length === 0) {
      throw new Error('Failed to fetch benchmark data');
    }
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    const results = await Promise.all(
      customLists.map(async (list) => {
        try {
          const stockSymbols = list.stocks.map((stock: string) => 
            stock.endsWith('.NS') ? stock : `${stock}.NS`
          );

          const stockResults = await Promise.allSettled(
            stockSymbols.map((stock: string) => fetchWithRetry(stock, startDate, endDate, interval, refreshParam))
          );

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
            return null;
          }

          const minLength = Math.min(
            Math.min(...validStocksData.map(d => d.closes.length)),
            benchmarkCloses.length
          );

          if (minLength < 5) {
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

          const validIndexPrices = indexPrices.filter(p => p !== null) as number[];
          const slicedBenchmark = benchmarkCloses.slice(-minLength);
          
          const fullHistory = calculateRRGData(validIndexPrices, slicedBenchmark, rsWindow, rocWindow);

          if (!fullHistory || fullHistory.length === 0) {
            return null;
          }

          const tailLength = Math.max(2, rsWindow);
          const tail = fullHistory.slice(-tailLength);

          return {
            id: list.id,
            name: list.name,
            stockCount: validStocksData.length,
            head: fullHistory[fullHistory.length - 1],
            tail: tail
          };
        } catch (error) {
          logger.error(`Error processing custom list ${list.name}:`, error);
          return null;
        }
      })
    );

    const validResults = results.filter(r => r !== null);

    logger.info(`Returning ${validResults.length} valid custom lists out of ${customLists.length}`);

    return NextResponse.json({ 
      lists: validResults,
      cacheHit: !refreshParam,
      config: {
        interval,
        rsWindow,
        rocWindow
      }
    });
  } catch (err: any) {
    logger.error('Custom lists API error:', err.message);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
