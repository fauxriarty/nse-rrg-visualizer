import { NextRequest, NextResponse } from 'next/server';
import { calculateRRGData } from '@/lib/rrgMath';
import { getChartQuotesWithFallback } from '@/lib/yfCache';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

async function fetchWithRetry(symbol: string, period1: Date, period2: Date, interval: '1d' | '1wk' | '1mo', retries = 2): Promise<any[]> {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await getChartQuotesWithFallback(symbol, period1, period2, interval);
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
    const stocksParam = searchParams.get('stocks') || '';
    const interval = (searchParams.get('interval') || '1d') as '1d' | '1wk' | '1mo';
    const rsWindow = parseInt(searchParams.get('rsWindow') || '14');
    const rocWindow = parseInt(searchParams.get('rocWindow') || '14');
    const dateParam = searchParams.get('date');

    if (!stocksParam) {
      return NextResponse.json({ error: 'No stocks specified' }, { status: 400 });
    }

    const stockSymbols = stocksParam.split(',').map(s => s.trim()).filter(s => s);

    if (stockSymbols.length === 0) {
      return NextResponse.json({ error: 'No valid stock symbols' }, { status: 400 });
    }

    const csvPath = path.join(process.cwd(), 'data', 'stocks', 'all_stocks_latest.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records: any[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    const stockTickers = stockSymbols.map(symbol => {
      const stock = records.find((r: any) => r.symbol === symbol);
      return stock ? stock.ticker : `${symbol}.NS`;
    });

    let endDate = dateParam ? new Date(dateParam) : new Date();
    let startDate = new Date(endDate);
    
    if (interval === '1d') {
      startDate.setFullYear(startDate.getFullYear() - 2);
    } else if (interval === '1wk') {
      startDate.setFullYear(startDate.getFullYear() - 5);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 10);
    }

    const benchmarkSymbol = '^NSEI';
    logger.info(`Fetching benchmark: ${benchmarkSymbol}`);
    let benchmarkData = await fetchWithRetry(benchmarkSymbol, startDate, endDate, interval);
    
    if (!benchmarkData || benchmarkData.length === 0) {
      throw new Error(`Failed to fetch benchmark data`);
    }
    
    const benchmarkCloses = benchmarkData.map((d: any) => d.close);

    logger.info(`Fetching ${stockTickers.length} stocks`);
    let stocksData: any[] = [];
    const batchSize = 3;
    
    for (let i = 0; i < stockTickers.length; i += batchSize) {
      const batch = stockTickers.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(ticker => fetchWithRetry(ticker, startDate, endDate, interval))
      );
      stocksData.push(...batchResults);
      
      if (i + batchSize < stockTickers.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    const results = stockTickers.map((ticker, index) => {
      const stockResult = stocksData[index];
      const symbol = stockSymbols[index];
      
      if (stockResult.status === 'rejected') {
        logger.warn(`Failed to fetch ${ticker}`);
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
        name: symbol,
        symbol: ticker,
        head,
        tail
      };
    }).filter(r => r !== null);

    logger.info(`Successfully processed ${results.length}/${stockTickers.length} stocks`);

    if (results.length === 0) {
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
    logger.error('Custom stocks API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
