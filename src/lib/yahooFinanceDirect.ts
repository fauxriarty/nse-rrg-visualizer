import { logger } from './logger';

interface YahooQuote {
  date: Date;
  close: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
}

export async function fetchChart(
  symbol: string,
  period1: Date,
  period2: Date,
  interval: '1d' | '1wk' | '1mo' | '1h' | '5m' = '1d'
): Promise<YahooQuote[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  
  const params = new URLSearchParams({
    period1: Math.floor(period1.getTime() / 1000).toString(),
    period2: Math.floor(period2.getTime() / 1000).toString(),
    interval,
    includeAdjustedClose: 'true',
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      throw new Error('No data returned from Yahoo Finance');
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const opens = result.indicators?.quote?.[0]?.open || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    const quotes: YahooQuote[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        quotes.push({
          date: new Date(timestamps[i] * 1000),
          close: closes[i],
          open: opens[i],
          high: highs[i],
          low: lows[i],
          volume: volumes[i],
        });
      }
    }

    return quotes;
  } catch (error: any) {
    logger.error(`fetchChart failed for ${symbol}:`, error.message);
    throw error;
  }
}

export async function fetchHistorical(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<YahooQuote[]> {
  return fetchChart(symbol, startDate, endDate, '1d');
}
