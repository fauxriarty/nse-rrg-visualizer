import { NextResponse } from 'next/server';
import { calculateRRGData } from '@/lib/rrgMath';
import { getChartQuotesWithFallback } from '@/lib/yfCache';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

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

async function fetchWithRetry(symbol: string, period1: Date, period2: Date, interval: '1d' | '1wk' | '1mo', retries = 2): Promise<any[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const quotes = await getChartQuotesWithFallback(symbol, period1, period2, interval);
      return quotes.filter((q: any) => q.close !== null && q.close !== undefined);
    } catch (err) {
      if (i === retries - 1) {
        logger.warn(`Failed to fetch ${symbol}`);
        return [];
      } 
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); 
    }
  }
  return [];
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const intervalParam = searchParams.get('interval');
    const rsWindowParam = searchParams.get('rsWindow');
    const rocWindowParam = searchParams.get('rocWindow');
    const dateParam = searchParams.get('date'); 

    const interval: '1d' | '1wk' | '1mo' = (intervalParam === '1d' || intervalParam === '1wk' || intervalParam === '1mo') ? intervalParam : '1wk';
    const rsWindow = rsWindowParam ? Math.max(parseInt(rsWindowParam) || 14, 5) : 14; 
    const rocWindow = rocWindowParam ? Math.max(parseInt(rocWindowParam) || 1, 1) : 1;

    const endDate = dateParam ? new Date(dateParam) : new Date();
    const startDate = new Date(endDate);
    
    if (interval === '1d') startDate.setDate(endDate.getDate() - 730); 
    else if (interval === '1wk') startDate.setDate(endDate.getDate() - 1825);
    else if (interval === '1mo') startDate.setDate(endDate.getDate() - 3650);

    // Fetch benchmark
    logger.info(`Fetching benchmark: ${BENCHMARK}`);
    let benchmarkData = await fetchWithRetry(BENCHMARK, startDate, endDate, interval);
    
    // Fetch sectors sequentially with delay to avoid rate limits
    const sectorsData: any[] = [];
    for (const sector of SECTORS) {
      const data = await fetchWithRetry(sector.symbol, startDate, endDate, interval);
      sectorsData.push(data);
      await new Promise(r => setTimeout(r, 300)); // 300ms delay between sectors
    }

    if (!benchmarkData || benchmarkData.length === 0) {
      // Try loading from local data as fallback
      logger.warn('Benchmark fetch failed, trying local data');
      const localPath = path.join(process.cwd(), 'data', 'stocks', 'stocks_by_sector_latest.json');
      if (fs.existsSync(localPath)) {
        const localData = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        logger.info('Using local data as fallback');
        return NextResponse.json(localData);
      }
      throw new Error("Failed to fetch benchmark data");
    }

    logger.info(`Benchmark: ${benchmarkData.length} quotes, Sectors fetched: ${sectorsData.filter(d => d.length > 0).length}/${SECTORS.length}`);

    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    const results = SECTORS.map((sector, index) => {
        const data = sectorsData[index];
        if (!data || data.length < 5) return null; 

        const closes = data.map((d: any) => d.close);
        const fullHistory = calculateRRGData(closes, benchmarkCloses, rsWindow, rocWindow);

        if (!fullHistory || fullHistory.length === 0) return null;

        const head = fullHistory[fullHistory.length - 1];
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
    logger.error('Market data API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}