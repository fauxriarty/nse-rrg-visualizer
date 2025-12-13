import { NextResponse } from 'next/server';
import  YahooFinance  from 'yahoo-finance2'; 
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
];

const BENCHMARK = '^NSEI';

// Explicit Promise return type to fix TS "length does not exist" errors
async function fetchWithRetry(symbol: string, options: any, retries = 2): Promise<any[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await yf.chart(symbol, options) as any;
      return res?.quotes || []; 
    } catch (err) {
      if (i === retries - 1) throw err; 
      await new Promise(r => setTimeout(r, 1000)); 
    }
  }
  return [];
}

export async function GET() {
  try {
    const queryOptions = { period1: '2023-01-01', interval: '1wk' as const };

    // 1. Fetch Benchmark
    let benchmarkCloses;
    try {
      const benchmarkData = await fetchWithRetry(BENCHMARK, queryOptions);
      if (!benchmarkData || benchmarkData.length === 0) throw new Error("Empty benchmark");
      benchmarkCloses = benchmarkData.map((d: any) => d.close);
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: 'Benchmark Fetch Failed' }, { status: 500 });
    }

    // 2. Fetch Sectors
    const results = await Promise.all(SECTORS.map(async (sector) => {
      try {
        const data = await fetchWithRetry(sector.symbol, queryOptions);
        if (!data || data.length === 0) return null;

        const closes = data.map((d: any) => d.close);
        const fullHistory = calculateRRGData(closes, benchmarkCloses);

        if (fullHistory.length < 5) return null;

        return {
          name: sector.name,
          head: fullHistory[fullHistory.length - 1] 
        };
      } catch (error) {
        return null;
      }
    }));

    return NextResponse.json({ 
      timestamp: new Date().toISOString(),
      sectors: results.filter(r => r !== null) 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}