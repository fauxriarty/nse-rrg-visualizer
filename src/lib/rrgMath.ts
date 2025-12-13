// 1. Calculate Simple Moving Average (SMA)
const calculateSMA = (data: number[], window: number) => {
  let sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      sma.push(null); // Not enough data yet
      continue;
    }
    const slice = data.slice(i - window + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    sma.push(sum / window);
  }
  return sma;
};

// 2. The Core RRG Logic
export const calculateRRGData = (
  symbolPrices: number[],
  benchmarkPrices: number[],
  window = 14 // 14-week lookback is standard for RRG
) => {
  // Align data lengths
  const minLength = Math.min(symbolPrices.length, benchmarkPrices.length);
  const slicedSymbol = symbolPrices.slice(-minLength);
  const slicedBenchmark = benchmarkPrices.slice(-minLength);

  // A. Calculate Raw Relative Strength (RS)
  const rsRaw = slicedSymbol.map((price, i) => (price / slicedBenchmark[i]) * 1000); // Multiplier for scale

  // B. Calculate RS-Ratio (X-Axis: Trend)
  // This is the RS normalized against its own Moving Average
  const rsMa = calculateSMA(rsRaw, window);
  
  const rsRatio = rsRaw.map((rs, i) => {
    if (!rsMa[i]) return null;
    // Formula: ((RS / MovingAverage(RS)) - 1) * 100 + 100
    // This centers the "Trend" around 100.
    return ((rs / rsMa[i]) * 100); 
  });

  // C. Calculate RS-Momentum (Y-Axis: Velocity)
  // This is the Rate of Change (ROC) of the RS-Ratio
  const momentumWindow = 1; // 1-period ROC acts as velocity
  const rsMomentum = rsRatio.map((ratio, i) => {
    const previousRatio = rsRatio[i - momentumWindow];
    if (i < momentumWindow || !ratio || !previousRatio) return null;
    // Formula: ((CurrentRatio / PreviousRatio) * 100)
    // Centers "Momentum" around 100.
    return ((ratio / previousRatio) * 100); 
  });

  // D. Package the data points
  // We filter out the nulls from the start of the array
  const points = rsRatio.map((ratio, i) => ({
    x: ratio,
    y: rsMomentum[i],
    dateIndex: i
  })).filter(p => p.x !== null && p.y !== null);

  return points;
};