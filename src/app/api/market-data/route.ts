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

    const [benchmarkData, ...sectorsData] = await Promise.all([
        fetchWithRetry(BENCHMARK, queryOptions),
        ...SECTORS.map(sector => fetchWithRetry(sector.symbol, queryOptions))
    ]);

    if (!benchmarkData || benchmarkData.length === 0) {
        throw new Error("Failed to fetch benchmark data");
    }
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    const results = SECTORS.map((sector, index) => {
        const data = sectorsData[index];
        if (!data || data.length < 5) return null; 

        const closes = data.map((d: any) => d.close);
        const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

        if (!fullHistory || fullHistory.length === 0) return null;

        // Always include at least last 2 points for day-over-day comparison, regardless of rsWindow
        const tailLength = Math.max(2, rsWindow);

        return {
          name: sector.name,
          head: fullHistory[fullHistory.length - 1], 
          tail: fullHistory.slice(-tailLength)
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