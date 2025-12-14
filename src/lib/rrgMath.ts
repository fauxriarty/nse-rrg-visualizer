// 1. Calculate Simple Moving Average (SMA) - Null Tolerant Version
const calculateSMA = (data: (number | null)[], window: number) => {
  let sma = [];
  for (let i = 0; i < data.length; i++) {
    // We still need enough history to start
    if (i < window - 1) {
      sma.push(null);
      continue;
    }
    
    const slice = data.slice(i - window + 1, i + 1);
    
    
    const validNumbers = slice.filter(v => v !== null && v !== undefined) as number[];
    
    // If we have less than 50% valid data for the window, then it's too risky to calculate.
    // Otherwise, compute average of what we have.
    if (validNumbers.length < Math.ceil(window * 0.5)) {
      sma.push(null);
    } else {
      const sum = validNumbers.reduce((a, b) => a + b, 0);
      sma.push(sum / validNumbers.length);
    }
  }
  return sma;
};

// 2. The Core RRG Logic
export const calculateRRGData = (
  symbolPrices: number[],
  benchmarkPrices: number[],
  rsWindow: number,
  rocWindow: number
) => {
  // A. Align data lengths (Right-aligned to ensure 'Today' matches)
  const minLength = Math.min(symbolPrices.length, benchmarkPrices.length);
  
  if (minLength < 5) return []; // Not enough data to map anything

  const slicedSymbol = symbolPrices.slice(-minLength);
  const slicedBenchmark = benchmarkPrices.slice(-minLength);

  // B. Adaptive Window Logic
  // If requested window is 50 but we only have 40 points, shrink it gracefully.
  let effectiveRsWindow = rsWindow;
  if (minLength <= rsWindow + rocWindow) {
      const maxPossibleWindow = Math.floor(minLength / 2);
      effectiveRsWindow = Math.min(rsWindow, Math.max(5, maxPossibleWindow));
  }

  // C. Calculate Raw Relative Strength (RS)
  const rsRaw = slicedSymbol.map((price, i) => {
      if (!price || !slicedBenchmark[i]) return null;
      return (price / slicedBenchmark[i]) * 1000;
  });

  // D. Calculate RS-Ratio (X-Axis: Trend)
  const rsMa = calculateSMA(rsRaw, effectiveRsWindow);
  
  const rsRatio = rsRaw.map((rs, i) => {
    if (rs === null || rsMa[i] === null || rsMa[i] === 0) return null;
    return ((rs / rsMa[i]!) * 100); 
  });

  // E. Calculate RS-Momentum (Y-Axis: Velocity)
  const rsMomentum = rsRatio.map((currentRatio, i) => {
    const pastIndex = i - rocWindow;
    
    if (pastIndex < 0 || currentRatio === null || rsRatio[pastIndex] === null) return null;
    
    const pastRatio = rsRatio[pastIndex]!;
    if (pastRatio === 0) return null;

    return ((currentRatio / pastRatio) * 100); 
  });

  // F. Package data points
  // We take the LAST valid point to represent the current state
  const validPoints = rsRatio.map((ratio, i) => ({
    x: ratio,
    y: rsMomentum[i],
    dateIndex: i
  })).filter(p => p.x !== null && p.y !== null);

  return validPoints;
};