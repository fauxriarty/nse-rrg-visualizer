import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2'; 
import { calculateRRGData } from '@/lib/rrgMath';

const yf = new YahooFinance({
  suppressNotices: ['ripHistorical', 'yahooSurvey']
});

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

async function fetchWithRetry(symbol: string, options: any, retries = 2): Promise<any[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await yf.chart(symbol, options) as any;
      const validQuotes = (res?.quotes || []).filter((q: any) => q.close !== null && q.close !== undefined);
      return validQuotes; 
    } catch (err) {
      if (i === retries - 1) {
          console.warn(`Failed to fetch ${symbol}`);
          return [];
      } 
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); 
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

// Helper: Check if NSE market is currently open (9:15 AM - 3:30 PM IST, Mon-Fri)
function isNSEMarketOpen(): boolean {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000) - now.getTimezoneOffset() * 60 * 1000);
  
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const day = istTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Not a trading day (Sunday=0 or Saturday=6)
  if (day === 0 || day === 6) return false;
  
  // Market hours: 9:15 AM to 3:30 PM
  const minutesToday = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15; // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  
  return minutesToday >= marketOpen && minutesToday < marketClose;
}

// Helper: Merge intraday latest close into daily data for today
async function enhanceDataWithIntraday(dailyQuotes: any[], symbol: string, endDateStr: string): Promise<any[]> {
  // Only enhance if we're querying for today and market might be open
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const intervalParam = searchParams.get('interval');
    const rsWindowParam = searchParams.get('rsWindow');
    const rocWindowParam = searchParams.get('rocWindow');
    
    // --- 1. BACKTESTING PARAMETER ---
    const dateParam = searchParams.get('date'); 

    const interval: '1d' | '1wk' | '1mo' = (intervalParam === '1d' || intervalParam === '1wk' || intervalParam === '1mo') ? intervalParam : '1wk';
    const rsWindow = rsWindowParam ? Math.max(parseInt(rsWindowParam) || 14, 5) : 14; 
    const rocWindow = rocWindowParam ? Math.max(parseInt(rocWindowParam) || 1, 1) : 1;

    // --- 2. TIME TRAVEL LOGIC ---
    // If a date is provided, use it as the "End Date" (Time Travel). Otherwise use Today.
    const endDate = dateParam ? new Date(dateParam) : new Date();
    const startDate = new Date(endDate); // Clone it to manipulate start date
    
    // Adjust buffer based on interval relative to the CHOSEN endDate
    if (interval === '1d') startDate.setDate(endDate.getDate() - 730); 
    else if (interval === '1wk') startDate.setDate(endDate.getDate() - 1825);
    else if (interval === '1mo') startDate.setDate(endDate.getDate() - 3650);

    const queryOptions = { 
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0], 
      interval: interval
    };

    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Fetch all data in parallel
    let benchmarkData = await fetchWithRetry(BENCHMARK, queryOptions);
    let sectorsData = await Promise.all(
      SECTORS.map(sector => fetchWithRetry(sector.symbol, queryOptions))
    );
    
    // Enhance with intraday data for today (only if NOT backtesting)
    if (!dateParam) {
      benchmarkData = await enhanceDataWithIntraday(benchmarkData, BENCHMARK, endDateStr);
      sectorsData = await Promise.all(
        sectorsData.map((data, idx) => enhanceDataWithIntraday(data, SECTORS[idx].symbol, endDateStr))
      );
    }

    if (!benchmarkData || benchmarkData.length === 0) {
        throw new Error("Failed to fetch benchmark data");
    }

    // Debug: log what date range we got back
    const lastBenchmarkQuote = benchmarkData[benchmarkData.length - 1];
    console.log('Market-Data API Debug:', {
      queryPeriod: { period1: queryOptions.period1, period2: queryOptions.period2 },
      lastQuoteDate: lastBenchmarkQuote?.date,
      lastQuoteTime: lastBenchmarkQuote?.datetime,
      dataSource: lastBenchmarkQuote?.lastUpdate || 'daily',
      totalQuotes: benchmarkData.length,
      today: new Date().toISOString().split('T')[0],
      isToday: isToday(endDateStr),
      marketOpen: isNSEMarketOpen(),
      daysFromToday: lastBenchmarkQuote?.date ? 
        Math.floor((new Date().getTime() - new Date(lastBenchmarkQuote.date).getTime()) / (1000*60*60*24)) : 'N/A'
    });
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    const results = SECTORS.map((sector, index) => {
        const data = sectorsData[index];
        if (!data || data.length < 5) return null; 

        const closes = data.map((d: any) => d.close);
        const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

        if (!fullHistory || fullHistory.length === 0) return null;

        // head is the current/last point
        const head = fullHistory[fullHistory.length - 1];
        
        // tail is historical data BEFORE the head (excluding head), at least 2 points for day-over-day comparison
        const tailLength = Math.max(2, rsWindow);
        const tail = fullHistory.slice(Math.max(0, fullHistory.length - tailLength - 1), fullHistory.length - 1);

        return {
          name: sector.name,
          head, 
          tail
        };
    }).filter(r => r !== null);

    return NextResponse.json({ 
      timestamp: new Date().toISOString(),
      config: { interval, rsWindow, rocWindow, backtestDate: dateParam || 'Live' },
      sectors: results
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}