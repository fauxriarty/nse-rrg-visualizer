# Yahoo Finance 2 - Sector Constituent Discovery

## Current Status

The `yahoo-finance2` npm package **does not provide** an automatic method to fetch all constituent stocks for a given sector index.

## What Yahoo Finance 2 Provides

- Historical price data for individual tickers
- Basic company information
- Chart data with OHLCV
- Quote summaries

## What It Does NOT Provide

- Sector membership lists
- Index constituent discovery
- Real-time sector composition updates

## Current Implementation

We maintain a manual list of sector constituents in `/src/lib/sectorConfig.ts`:

```typescript
export const SECTOR_CONSTITUENTS: Record<string, { name: string; stocks: string[] }> = {
  '^NSEBANK': {
    name: 'Bank',
    stocks: ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', ...]
  },
  // ... other sectors
}
```

## Alternative Solutions

If you need automated sector discovery:

1. **NSE Official API** - Requires registration and may have rate limits
2. **Web Scraping** - Parse NSE website HTML (fragile, against ToS)
3. **Commercial Data Providers** - Bloomberg API, Refinitiv, etc. (paid)
4. **Manual Updates** - Periodic manual review of NSE sector composition (current approach)

## Recommendation

For production use, maintain the current manual list and:
- Update quarterly when NSE rebalances indices
- Add a cron job to validate ticker symbols are still active
- Consider switching to a commercial data provider for automated updates

## Implementation Note

Our current `/api/sector-stocks` route uses the manually maintained list from `sectorConfig.ts`. To update constituents, edit that file directly.
