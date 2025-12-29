# Custom Lists as Sectors - User Guide

## 🎯 Quick Start

### 1. Create Your First Custom List
1. Go to **Custom Analysis** page
2. Click **"Analyze List Stocks"** button at the top
3. Search for stocks in the search bar (e.g., "RELIANCE", "TCS", "INFY")
4. Click on each stock to add them to your list
5. Selected stocks appear as blue pills
6. Click **"Save List"** and give it a name
7. Your list is now saved and ready to use!

### 2. View All Custom Lists as Sectors
1. Click **"View All Custom Lists"** button at the top
2. All your saved custom lists now appear as "sectors" in the RRG chart
3. Each list shows its calculated index position against NIFTY 50
4. Hover over any list to see more details
5. This view is similar to the Market Overview page

### 3. Analyze Stocks in a Custom List
1. Go back to **"Analyze List Stocks"** mode
2. Your saved lists appear in the configuration area
3. Select a list from the dropdown to load its stocks
4. The selected stocks are automatically displayed
5. Choose benchmark:
   - **NIFTY 50**: Compare against overall market
   - **Custom Index**: Compare against your list's calculated index
6. View how each stock performs relative to chosen benchmark

## 📊 Understanding the Views

### Overview Mode: "View All Custom Lists"
```
┌─────────────────────────────────────┐
│  Custom Analysis Configuration       │
│  ☐ View All Custom Lists (Selected) │
│  ☐ Analyze List Stocks              │
└─────────────────────────────────────┘
            ↓
    RRG Chart showing:
    - "Tech Giants" list
    - "Pharma Leaders" list  
    - "Banking Sector" list
    - ... (each as a sector-like item)
    
Each with:
- Relative Strength vs NIFTY 50
- Momentum
- Position in RRG quadrants
```

### Detail Mode: "Analyze List Stocks"
```
┌─────────────────────────────────────┐
│  Custom Analysis Configuration       │
│  ☐ View All Custom Lists            │
│  ☐ Analyze List Stocks (Selected)   │
│  Benchmark: [NIFTY 50 ▼]           │
│             [Custom Index ▼]        │
└─────────────────────────────────────┘
            ↓
Search Bar: [Search for stocks...]    │
     [Add: RELIANCE] [Add: TCS]
            ↓
Selected Stocks:
  [RELIANCE ✕] [TCS ✕] [INFY ✕]
            ↓
    RRG Chart showing:
    - Each stock's position
    - Relative to chosen benchmark
    - Momentum vectors
```

## 🔧 Configuration Options

### Available in Both Modes

1. **Interval**
   - Daily (1d): Recent trends, 2 years of data
   - Weekly (1wk): Medium-term patterns, 5 years of data
   - Monthly (1mo): Long-term trends, 10 years of data

2. **RS Period** (Relative Strength Window)
   - How many periods to average for trend calculation
   - Default: 14 (standard)
   - Higher = smoother trends, Lower = more responsive

3. **ROC Period** (Rate of Change Window)
   - How many periods back to compare for momentum
   - Default: 14
   - Lower = faster momentum detection

4. **Backtest Date**
   - Click to select any historical date
   - All calculations use data up to that date
   - Useful for historical analysis

### Detail Mode Only

5. **Benchmark**
   - **NIFTY 50**: Traditional market comparison
     - Shows stock performance vs overall market
     - Red quadrant: Underperformer with weak momentum
     - Green quadrant: Outperformer with strong momentum
   
   - **Custom Index**: Custom list comparison
     - Shows stock performance vs list average
     - Useful for finding leaders/laggards within your curated list
     - Equal-weighted comparison of all stocks in the list

## 📈 Understanding the RRG Chart

### What the Position Means

The RRG (Relative Rotation Graph) has 4 quadrants:

```
           ↑ Momentum
           │
    Weak   │   Strong
 Momentum  │  Momentum
    ───────┼─────────
    L I P  │  L I R
    Weak   │  Weak Strength
    ←──────┼─────→
          Strength
    Weak S │  Strong S
    ───────┼─────────
    L O P  │  L O R
    Strong │  Strength
    Momentum│
           ↓
```

### The Four Quadrants

1. **Leading (Upper Right)**
   - Strong relative strength + Strong momentum
   - Best performers, likely to continue outperforming
   - Green zone - BUY signal

2. **Weakening (Upper Left)**
   - Weak relative strength + Strong momentum
   - Starting to lose strength despite momentum
   - Caution - may reverse soon

3. **Lagging (Lower Left)**
   - Weak relative strength + Weak momentum
   - Worst performers, likely to continue underperforming
   - Red zone - AVOID/SELL signal

4. **Improving (Lower Right)**
   - Strong relative strength + Weak momentum
   - Recovering from weakness, building strength
   - Blue zone - Watch for reversal signals

## 🎯 Common Use Cases

### Case 1: Building a Momentum Portfolio
1. Create a custom list: "Momentum Picks"
2. Add stocks showing strong relative strength and momentum
3. Monitor in overview mode to see how your list compares to market
4. Use detail mode with NIFTY 50 benchmark to identify best performers
5. Adjust periodically as momentum changes

### Case 2: Sector Rotation Analysis
1. Create multiple lists:
   - "Tech Leaders"
   - "Banking Stocks"
   - "Pharma Plays"
2. Switch to overview mode
3. Compare which sector list is in leading quadrant
4. Switch to detail mode to find best picks within leading sector

### Case 3: Tracking Your Portfolio
1. Create a list with stocks you own
2. View in overview mode to see portfolio index vs market
3. Use detail mode with custom index to identify underperformers
4. Make rebalancing decisions based on rotation patterns

## 💡 Tips & Tricks

### Tip 1: Backtest Your Strategy
- Select past dates to see how your custom list would have performed
- Compare against historical NIFTY 50 movements
- Identify patterns in your stocks' behavior

### Tip 2: Create Multiple Lists
- Create lists for different strategies/themes
- Compare them side-by-side in overview mode
- Find the best rotation patterns

### Tip 3: Use Different Intervals
- Daily for short-term trading strategies
- Weekly for medium-term position trading
- Monthly for long-term investment thesis

### Tip 4: Compare Benchmarks
- Use NIFTY 50 to understand market context
- Switch to custom index to find relative winners within your picks
- This dual comparison gives complete picture

### Tip 5: Watch the Tail
- The chart shows recent history (tail) and current position (head)
- Watch if stocks are moving into new quadrants
- Strong directional movement can signal trend changes

## ⚠️ Important Notes

### Index Calculation
- Custom list index uses **equal-weighting** (simple average)
- Each stock counts equally regardless of market cap
- Different from market-cap weighted sector indices
- More transparent and easier to understand

### Data Updates
- Market data fetches at regular intervals
- Backtest dates show historical data from that point
- Real-time quotes for current analysis

### Authentication
- Must be logged in to create/view custom lists
- Lists are private to your account
- No sharing between users (currently)

## 🔄 Workflow Summary

```
START
  ↓
LOGIN
  ↓
CREATE CUSTOM LISTS
  ├─ Search stocks
  ├─ Add to list
  └─ Save list
  ↓
ANALYZE IN OVERVIEW MODE
  ├─ See all lists as sectors
  ├─ Compare list indices
  └─ Identify best rotations
  ↓
ANALYZE IN DETAIL MODE
  ├─ Select a list
  ├─ Choose benchmark (NIFTY or Index)
  ├─ View individual stocks
  └─ Identify outliers
  ↓
MAKE DECISIONS
  ├─ Rebalance portfolio
  ├─ Adjust strategy
  └─ Create new lists
  ↓
REPEAT
```

## 🆘 Troubleshooting

### Problem: "No data available"
- Solution: Check if stocks are valid NSE symbols (use .NS suffix in search)
- Solution: Ensure stocks have sufficient historical data
- Solution: Try refreshing the page

### Problem: Custom index not calculating
- Solution: Ensure list has at least 1 stock
- Solution: Check if all stocks have valid data
- Solution: Try with NIFTY 50 benchmark first to verify system is working

### Problem: List not appearing in overview
- Solution: Switch to detail mode and save the list properly
- Solution: Refresh the page
- Solution: Check if you're logged in with correct account

### Problem: Different results with different benchmarks
- This is normal! Custom index = average of your stocks
- NIFTY 50 = broader market index
- Different benchmarks give different perspectives

## 📞 Support

For detailed technical information, see:
- `CUSTOM_LISTS_FEATURE.md` - Complete feature documentation
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details
