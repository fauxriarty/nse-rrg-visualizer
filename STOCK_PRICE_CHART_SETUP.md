# Stock Price Chart on Hover - Setup Guide

## Feature Overview
When you hover over any stock point in the RRG chart on **Sector Analysis** or **Custom Analysis** pages, a modal popup will appear showing the stock's price chart for the last 3 months.

## Installation

### 1. Install Required Package
```bash
npm install yahoo-finance2
```

### 2. Files Created/Modified

**New Files:**
- `/src/components/StockPriceChart.tsx` - Modal component for displaying price chart
- `/src/app/api/stock-price/route.ts` - API endpoint for fetching stock prices

**Modified Files:**
- `/src/components/RRGChart.tsx` - Added `onStockHover` callback prop
- `/src/app/sectors/page.tsx` - Added hover handler and StockPriceChart integration
- `/src/app/custom/page.tsx` - Added hover handler and StockPriceChart integration

## How It Works

1. **Hover Detection**: When you hover over a stock point in the RRG chart, the component emits the stock name via the `onStockHover` callback.

2. **Modal Display**: The StockPriceChart modal automatically opens and fetches the stock's historical price data for the last 3 months.

3. **Price Data**: The API fetches historical OHLC (Open, High, Low, Close) data from Yahoo Finance using the `yahoo-finance2` library.

4. **Chart Rendering**: The modal displays a line chart showing the closing price over time, with interactive tooltips.

## Usage

### Sector Analysis Page
- Navigate to `/sectors`
- Hover over any stock point in the chart
- A modal will appear showing the 3-month price trend
- Close the modal by clicking the X button or the "Close" button

### Custom Analysis Page
- Navigate to `/custom`
- Add stocks and click "Fetch Data"
- Hover over any stock point in the chart
- The price chart modal will appear

## Stock Symbol Format

The API accepts standard stock symbols:
- **Indian Stocks**: Use NSE format (e.g., "RELIANCE.NS", "TCS.NS")
- **US Stocks**: Use ticker format (e.g., "AAPL", "GOOGL")

The page automatically handles the correct format for your stocks.

## Error Handling

If a stock symbol is not found or the API fails:
- An error message will be displayed in the modal
- The user can close it and try another stock
- Check the browser console for detailed error logs

## Customization

### Change the Time Period
In `/src/app/api/stock-price/route.ts`, modify:
```typescript
// Currently set to 3 months
startDate.setMonth(startDate.getMonth() - 3);

// Change to 6 months:
startDate.setMonth(startDate.getMonth() - 6);

// Change to 1 year:
startDate.setFullYear(startDate.getFullYear() - 1);
```

### Modify Chart Styling
Edit the color scheme in `/src/components/StockPriceChart.tsx`:
```tsx
<Line 
  type="monotone" 
  dataKey="close" 
  stroke="#60a5fa"  // Change this color
  strokeWidth={2}
  dot={false}
  name="Close Price"
/>
```

### Change Interval
In `/src/app/api/stock-price/route.ts`, modify the interval:
```typescript
// Options: '1d' (daily), '1wk' (weekly), '1mo' (monthly)
interval: '1d'  // Currently daily
```

## Troubleshooting

### "No price data available" error
- Stock symbol might not exist or be incorrectly formatted
- Yahoo Finance might not have data for this ticker
- Try with a popular stock like "RELIANCE.NS" or "AAPL"

### Modal not appearing
- Check browser console for API errors
- Verify the stock symbol is correct
- Ensure the API endpoint is accessible

### Price data looks incomplete
- The stock might not have 3 months of trading history
- Yahoo Finance might have data gaps
- Try a different stock or time period

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive design)

## Performance Notes

- Initial load may take 1-2 seconds to fetch data
- Subsequent hovers on the same stock are instant (cached)
- The modal closes automatically if you move away from the chart
