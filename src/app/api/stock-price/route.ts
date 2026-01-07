import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalWithFallback } from '@/lib/yfCache';
import { logger } from '@/lib/logger';

async function fetchHistoricalData(symbol: string, startDate: Date, endDate: Date) {
  const formats = [
    symbol,
    `${symbol}.NS`,
    `${symbol}.BO`,
  ];

  let lastError: any;

  for (const fmt of formats) {
    try {
      const result = await getHistoricalWithFallback(fmt, startDate, endDate);
      if (result && result.length > 0) {
        return result;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('No data found for any symbol format');
}

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    const result = await fetchHistoricalData(symbol, startDate, endDate);

    const prices = [...result]
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((quote: any) => ({
        date: new Date(quote.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        close: parseFloat(quote.close.toFixed(2)),
        high: parseFloat((quote.high || quote.close).toFixed(2)),
        low: parseFloat((quote.low || quote.close).toFixed(2)),
      }));

    return NextResponse.json({ prices });
  } catch (err: any) {
    logger.error('Stock price fetch error:', err);
    return NextResponse.json(
      { error: `Stock symbol "${req.nextUrl.searchParams.get('symbol')}" not found. Make sure it's a valid stock symbol.` },
      { status: 404 }
    );
  }
}
