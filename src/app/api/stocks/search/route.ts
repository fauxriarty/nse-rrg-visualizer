import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Read the CSV file with all stocks
    const csvPath = path.join(process.cwd(), 'data', 'stocks', 'all_stocks_latest.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const records: any[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Search by symbol or name (case-insensitive)
    const normalizedQuery = query.toLowerCase();
    const results = records
      .filter((stock: any) => {
        const symbolMatch = stock.symbol && stock.symbol.toLowerCase().includes(normalizedQuery);
        const nameMatch = stock.name && stock.name.toLowerCase().includes(normalizedQuery);
        return symbolMatch || nameMatch;
      })
      .slice(0, 10) // Limit to 10 results
      .map((stock: any) => ({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        ticker: stock.ticker
      }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Stock search error:', error);
    return NextResponse.json({ error: 'Failed to search stocks' }, { status: 500 });
  }
}
