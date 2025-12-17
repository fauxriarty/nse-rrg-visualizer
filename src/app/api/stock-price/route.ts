import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Helper to try multiple symbol formats
async function fetchHistoricalData(symbol: string, startDate: Date, endDate: Date) {
  const formats = [
    symbol, // Try as-is first
    `${symbol}.NS`, // NSE format
    `${symbol}.BO`, // BSE format
  ];

  let lastError: any;

  for (const fmt of formats) {
    try {
      const result = await yahooFinance.historical(fmt, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });

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

    // Fetch last 3 months of historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    const result = await fetchHistoricalData(symbol, startDate, endDate);

    // Sort explicitly by date to ensure X-axis goes left→right (oldest→newest)
    const prices = [...result]
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((quote: any) => ({
        date: new Date(quote.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        close: parseFloat(quote.close.toFixed(2)),
        high: parseFloat(quote.high.toFixed(2)),
        low: parseFloat(quote.low.toFixed(2)),
      }));

    return NextResponse.json({ prices });
  } catch (err: any) {
    console.error('Stock price fetch error:', err);

    return NextResponse.json(
      { error: `Stock symbol "${req.nextUrl.searchParams.get('symbol')}" not found on Yahoo Finance. Make sure it's a valid stock symbol.` },
      { status: 404 }
    );
  }
}
