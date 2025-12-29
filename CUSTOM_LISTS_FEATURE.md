# Custom Lists as Sectors Feature Documentation

## Overview

The new Custom Lists as Sectors feature allows you to treat your custom stock lists as if they were market sectors. Each custom list gets its own calculated index (using equal-weighted methodology), and you can analyze:

1. **Overview Mode**: View all your custom lists as "sectors" in the RRG chart, each with a calculated index
2. **Detail Mode**: Select a custom list and analyze individual stocks within it against either:
   - The custom list's calculated index
   - NIFTY 50 benchmark

## Key Components

### 1. **RRG Math Utilities** (`src/lib/rrgMath.ts`)

Three new functions added:

#### `calculateCustomListIndexPrice(stockPricesArray, dateIndex)`
Calculates the equal-weighted average price of stocks in a custom list at a specific date.

```typescript
// Takes an array of price series and a date index
// Returns the equal-weighted average price at that point
const indexPrice = calculateCustomListIndexPrice([[100,101,...], [200,202,...]], 0);
```

#### `calculateCustomListRRGData(stockPricesArrays, benchmarkPrices, rsWindow, rocWindow)`
Calculates RRG (Relative Rotation Graphs) data for a custom list index against a benchmark.

```typescript
// Returns both the calculated index prices and RRG data points
const { indexPrices, rrgDataPoints } = calculateCustomListRRGData(
  stockPricesArrays,
  benchmarkPrices,
  14,  // RS window
  14   // ROC window
);
```

### 2. **Custom Lists Index API** (`src/app/api/custom-lists-index/route.ts`)

**Endpoint**: `GET /api/custom-lists-index`

**Parameters**:
- `interval`: `1d` | `1wk` | `1mo` (default: `1d`)
- `rsWindow`: Number (default: `14`)
- `rocWindow`: Number (default: `14`)
- `date`: YYYY-MM-DD (optional, for backtesting)

**Headers**:
- `x-user-id`: User ID (required for authentication)

**Response**:
```json
{
  "lists": [
    {
      "id": "list-uuid",
      "name": "Tech Giants",
      "stockCount": 3,
      "head": { "x": 102.5, "y": 98.3, "dateIndex": 249 },
      "tail": [
        { "x": 101.2, "y": 97.8, "dateIndex": 248 },
        { "x": 102.5, "y": 98.3, "dateIndex": 249 }
      ]
    },
    ...
  ],
  "config": {
    "interval": "1d",
    "rsWindow": 14,
    "rocWindow": 14
  }
}
```

**How it works**:
1. Fetches all custom lists for the authenticated user from Supabase
2. For each list, fetches stock price data for all constituent stocks
3. Calculates equal-weighted index price for each date
4. Computes RRG metrics against NIFTY 50 benchmark
5. Returns the current position (head) and recent history (tail) for the RRG chart

### 3. **Updated Custom Page UI** (`src/app/custom/page.tsx`)

#### Two Modes:

**Overview Mode** ("View All Custom Lists")
- Displays all user's custom lists as "sectors" in the RRG chart
- Each custom list shows its calculated index position relative to NIFTY 50
- Similar visualization to the main market overview page
- Shows count of custom lists at the top
- If no lists exist, prompts user to create one in detail mode

**Detail Mode** ("Analyze List Stocks")
- Create or select a custom list
- Search and add individual stocks
- Choose benchmark: NIFTY 50 or Custom List Index
- View stocks in the RRG chart relative to chosen benchmark
- Save new lists or modify existing ones

## Detailed Feature Breakdown

### Benchmark Selection in Detail Mode

When in detail mode, you can choose between two benchmarks:

1. **NIFTY 50**: Traditional market comparison
   - Shows how stocks perform relative to the overall market
   - Uses NIFTY 50 index as the reference

2. **Custom Index**: Custom List Comparison
   - Shows how stocks perform relative to the custom list's calculated index
   - Useful for identifying outliers within your curated portfolio
   - The custom list index is calculated as the equal-weighted average of all stocks in the list

### Equal-Weighted Methodology

The custom list index uses **equal weighting** (simple average) rather than market-cap weighting:

```
Custom List Index = (Stock1_Price + Stock2_Price + Stock3_Price + ...) / Number_of_Stocks
```

This is similar to how NSE calculates some sector indices. Benefits:
- Simple and transparent
- Gives equal importance to each stock
- Easy to understand and verify
- Dynamically updates as you add/remove stocks

### Data Synchronization

The system maintains data consistency across modes:
- Custom lists are fetched from Supabase
- Both modes use the same authentication system
- Changes in one mode are reflected in the other
- Real-time updates when you save/modify lists

## Usage Flow

### Creating and Analyzing a Custom List

1. **Navigate to Custom Analysis page** → Switch to "Analyze List Stocks" mode
2. **Create a new list**:
   - Search for stocks using the search bar
   - Add stocks by clicking on them
   - Selected stocks appear as blue pills with X to remove
   - Click "Save List" button and give it a name
3. **View as a sector**:
   - Switch to "Overview Mode"
   - Your newly saved list appears in the RRG chart as a "sector"
   - See how your list's index compares to NIFTY 50
4. **Detailed analysis**:
   - Go back to "Analyze List Stocks"
   - Your list can be selected from saved lists
   - Choose between comparing to NIFTY 50 or your custom index
   - Analyze individual stocks within the list

### Backtesting

Both modes support backtesting via the "Backtest Date" selector:
- Select any historical date
- All calculations are performed from that date perspective
- Useful for historical RRG analysis

## Technical Implementation Details

### Data Flow for Overview Mode

```
User's Custom Lists (Supabase)
    ↓
Fetch stock prices for each list
    ↓
Calculate equal-weighted index for each date
    ↓
Compute RRG vs NIFTY 50
    ↓
Display in RRG chart as "sectors"
```

### Data Flow for Detail Mode with Custom Index Benchmark

```
Selected Custom List Stocks
    ↓
Fetch prices for all stocks
    ↓
Calculate equal-weighted index (same as overview)
    ↓
Use calculated index as benchmark
    ↓
Compute RRG for each stock vs custom index
    ↓
Display individual stocks in RRG chart
```

## Configuration Parameters

### Interval
- **Daily (1d)**: Best for short-term analysis (2 years of data)
- **Weekly (1wk)**: Medium-term trends (5 years of data)
- **Monthly (1mo)**: Long-term patterns (10 years of data)

### RS Period (Relative Strength Window)
- Default: 14 bars
- Options vary by interval for optimal analysis

### ROC Period (Rate of Change Window)
- Default: 14 bars (though typically 1 for fast momentum)
- Shows velocity of momentum changes

### Settings Persistence
- All settings are saved to user preferences
- Can be reset to defaults with one click
- Automatic defaults loaded on page visit

## Error Handling

The feature includes comprehensive error handling:

1. **Authentication Errors**: Redirect to login if not authenticated
2. **Network Errors**: Graceful fallback with error messages
3. **No Data Available**: Clear empty states for overview and detail modes
4. **Stock Fetch Failures**: Individual stocks are skipped if data unavailable
5. **List Management**: Validation for list creation and modification

## Performance Considerations

1. **Parallel Data Fetching**: Stock data is fetched in parallel with Promise.allSettled
2. **Batch Processing**: Requests are batched to avoid rate limiting
3. **Caching**: User settings are cached in localStorage
4. **Lazy Loading**: Data is fetched only when needed based on mode

## Future Enhancement Possibilities

1. **Weighted Indices**: Support for market-cap weighted custom indices
2. **Custom Benchmarks**: Use any list as a benchmark for another
3. **List Statistics**: Show composition details, correlation matrices
4. **Alerts**: Price alerts for custom lists
5. **Export**: Export RRG data and charts as images
6. **Collaborations**: Share custom lists with other users
7. **Advanced Filtering**: Filter stocks by sector, market cap, etc.

## API Response Examples

### Overview Mode Response
```json
{
  "lists": [
    {
      "id": "abc123",
      "name": "Tech Giants",
      "stockCount": 5,
      "head": { "x": 105.2, "y": 102.1, "dateIndex": 500 },
      "tail": [
        { "x": 104.8, "y": 100.5, "dateIndex": 499 },
        { "x": 105.2, "y": 102.1, "dateIndex": 500 }
      ]
    },
    {
      "id": "def456",
      "name": "Pharma Leaders",
      "stockCount": 4,
      "head": { "x": 98.5, "y": 99.2, "dateIndex": 500 },
      "tail": [
        { "x": 98.1, "y": 98.8, "dateIndex": 499 },
        { "x": 98.5, "y": 99.2, "dateIndex": 500 }
      ]
    }
  ]
}
```

## Testing the Feature

1. Create multiple custom lists with 3-5 stocks each
2. Switch between overview and detail modes
3. Test with different intervals and parameters
4. Try backtesting with historical dates
5. Compare results between NIFTY 50 and custom index benchmarks
6. Verify saved lists persist across sessions
