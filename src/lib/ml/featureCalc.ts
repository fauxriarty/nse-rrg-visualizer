export type MlFeatureVector = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export interface MlFeatureSnapshot {
  RS_Ratio: number;
  RS_Momentum: number;
  Distance: number;
  Angle: number;
  Angular_Velocity: number;
  Acceleration: number;
  Return_5d: number;
  Volatility_20d: number;
}

const RS_SMA_WINDOW = 14;
const MOMENTUM_ROC_WINDOW = 14;
const VELOCITY_LAG = 3;
const RETURN_WINDOW = 5;
const VOLATILITY_RETURNS_WINDOW = 20;
const ANNUALIZATION_FACTOR = 252;

const isFiniteNumber = (value: number) => Number.isFinite(value);

const mean = (values: number[]) => values.reduce((acc, value) => acc + value, 0) / values.length;

const standardDeviation = (values: number[]) => {
  if (values.length === 0) return 0;
  const mu = mean(values);
  const variance = values.reduce((acc, value) => {
    const delta = value - mu;
    return acc + delta * delta;
  }, 0) / values.length;
  return Math.sqrt(variance);
};

const smaAtIndex = (series: number[], index: number, window: number) => {
  const start = index - window + 1;
  if (start < 0) return null;
  const slice = series.slice(start, index + 1);
  if (slice.some((value) => !isFiniteNumber(value))) return null;
  return mean(slice);
};

const percentReturn = (current: number, past: number) => {
  if (past === 0) return null;
  return ((current - past) / past) * 100;
};

const rsRawSeries = (sectorPrices: number[], benchmarkPrices: number[]) => {
  const minLength = Math.min(sectorPrices.length, benchmarkPrices.length);
  const sector = sectorPrices.slice(-minLength);
  const benchmark = benchmarkPrices.slice(-minLength);

  const rsRaw = sector.map((price, i) => {
    const bench = benchmark[i];
    if (!isFiniteNumber(price) || !isFiniteNumber(bench) || bench === 0) return NaN;
    return (price / bench) * 1000;
  });

  return { minLength, sector, rsRaw };
};

const rsRatioAtIndex = (rsRaw: number[], index: number) => {
  const rs = rsRaw[index];
  if (!isFiniteNumber(rs)) return null;
  const rsSma = smaAtIndex(rsRaw, index, RS_SMA_WINDOW);
  if (rsSma === null || rsSma === 0) return null;
  return (rs / rsSma) * 100;
};

const rsMomentumAtIndex = (rsRaw: number[], index: number) => {
  const currentRatio = rsRatioAtIndex(rsRaw, index);
  if (currentRatio === null) return null;

  const priorRatio = rsRatioAtIndex(rsRaw, index - MOMENTUM_ROC_WINDOW);
  if (priorRatio === null || priorRatio === 0) return null;

  // Express momentum around 100 so (100,100) remains the RRG center.
  return (currentRatio / priorRatio) * 100;
};

const distanceFromCenter = (rsRatio: number, rsMomentum: number) => {
  const dx = rsRatio - 100;
  const dy = rsMomentum - 100;
  return Math.sqrt(dx * dx + dy * dy);
};

const angleFromCenter = (rsRatio: number, rsMomentum: number) => {
  const dx = rsRatio - 100;
  const dy = rsMomentum - 100;
  return Math.atan2(dy, dx);
};

const latestReturns = (prices: number[], count: number) => {
  if (prices.length < count + 1) return null;
  const tail = prices.slice(-(count + 1));
  const returns: number[] = [];

  for (let i = 1; i < tail.length; i++) {
    const prev = tail[i - 1];
    const curr = tail[i];
    if (!isFiniteNumber(prev) || !isFiniteNumber(curr) || prev === 0) return null;
    returns.push((curr - prev) / prev);
  }

  return returns;
};

export const calculateSectorMlFeatures = (
  sectorPrices: number[],
  benchmarkPrices: number[]
): MlFeatureSnapshot | null => {
  const { minLength, sector, rsRaw } = rsRawSeries(sectorPrices, benchmarkPrices);
  const currentIndex = minLength - 1;
  const laggedIndex = currentIndex - VELOCITY_LAG;

  if (laggedIndex < 0) return null;

  const currentRatio = rsRatioAtIndex(rsRaw, currentIndex);
  const currentMomentum = rsMomentumAtIndex(rsRaw, currentIndex);
  const laggedRatio = rsRatioAtIndex(rsRaw, laggedIndex);
  const laggedMomentum = rsMomentumAtIndex(rsRaw, laggedIndex);

  if (
    currentRatio === null ||
    currentMomentum === null ||
    laggedRatio === null ||
    laggedMomentum === null
  ) {
    return null;
  }

  const currentDistance = distanceFromCenter(currentRatio, currentMomentum);
  const currentAngle = angleFromCenter(currentRatio, currentMomentum);

  const laggedDistance = distanceFromCenter(laggedRatio, laggedMomentum);
  const laggedAngle = angleFromCenter(laggedRatio, laggedMomentum);

  if (sector.length <= RETURN_WINDOW) return null;
  const currentPrice = sector[sector.length - 1];
  const pastPrice = sector[sector.length - 1 - RETURN_WINDOW];
  if (!isFiniteNumber(currentPrice) || !isFiniteNumber(pastPrice)) return null;

  const return5d = percentReturn(currentPrice, pastPrice);
  if (return5d === null) return null;

  const dailyReturns = latestReturns(sector, VOLATILITY_RETURNS_WINDOW);
  if (!dailyReturns) return null;

  const volatility20d = standardDeviation(dailyReturns) * Math.sqrt(ANNUALIZATION_FACTOR) * 100;

  return {
    RS_Ratio: currentRatio,
    RS_Momentum: currentMomentum,
    Distance: currentDistance,
    Angle: currentAngle,
    Angular_Velocity: currentAngle - laggedAngle,
    Acceleration: currentDistance - laggedDistance,
    Return_5d: return5d,
    Volatility_20d: volatility20d,
  };
};

export const toFeatureVector = (snapshot: MlFeatureSnapshot): MlFeatureVector => [
  snapshot.RS_Ratio,
  snapshot.RS_Momentum,
  snapshot.Distance,
  snapshot.Angle,
  snapshot.Angular_Velocity,
  snapshot.Acceleration,
  snapshot.Return_5d,
  snapshot.Volatility_20d,
];
