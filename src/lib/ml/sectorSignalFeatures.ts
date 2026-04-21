type NumberArray = number[];

export interface SectorPrimarySnapshot {
  RS_Ratio: number;
  RS_Momentum: number;
  Distance: number;
  Angle: number;
  Angular_Velocity: number;
  Acceleration: number;
  Ret_5d: number;
  Vol_20d: number;
  Excess_Ret_5d: number;
  Excess_Ret_20d: number;
  Corr_60d: number;
  Beta_60d: number;
  DD_60d: number;
  Vol_Ratio: number;
  Bench_Ret_20d: number;
  Bench_Vol_20d: number;
}

export interface SectorPrimaryRanks {
  Rank_RS_Ratio: number;
  Rank_RS_Momentum: number;
  Rank_Excess_Ret_20d: number;
  Rank_Vol_20d: number;
}

export type SectorPrimaryFeatureVector = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const RS_SMA_WINDOW = 14;
const MOMENTUM_ROC_WINDOW = 14;
const VELOCITY_LAG = 3;
const RETURN_5D = 5;
const RETURN_20D = 20;
const VOL_WINDOW = 20;
const CORR_BETA_WINDOW = 60;
const DD_WINDOW = 60;

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
  if (!isFiniteNumber(current) || !isFiniteNumber(past) || past === 0) return null;
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

  return { minLength, sector, benchmark, rsRaw };
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

const rollingCorrelation = (seriesA: NumberArray, seriesB: NumberArray, window: number) => {
  if (seriesA.length < window || seriesB.length < window) return null;
  const tailA = seriesA.slice(-window);
  const tailB = seriesB.slice(-window);

  if (tailA.some((value) => !isFiniteNumber(value)) || tailB.some((value) => !isFiniteNumber(value))) {
    return null;
  }

  const meanA = mean(tailA);
  const meanB = mean(tailB);
  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < window; i++) {
    const da = tailA[i] - meanA;
    const db = tailB[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return null;
  return cov / denom;
};

const rollingBeta = (seriesA: NumberArray, seriesB: NumberArray, window: number) => {
  if (seriesA.length < window || seriesB.length < window) return null;
  const tailA = seriesA.slice(-window);
  const tailB = seriesB.slice(-window);

  if (tailA.some((value) => !isFiniteNumber(value)) || tailB.some((value) => !isFiniteNumber(value))) {
    return null;
  }

  const meanA = mean(tailA);
  const meanB = mean(tailB);
  let cov = 0;
  let varB = 0;

  for (let i = 0; i < window; i++) {
    const da = tailA[i] - meanA;
    const db = tailB[i] - meanB;
    cov += da * db;
    varB += db * db;
  }

  if (varB === 0) return null;
  return cov / varB;
};

const percentileRank = (value: number, series: number[]) => {
  const valid = series.filter((item) => Number.isFinite(item));
  if (valid.length === 0 || !Number.isFinite(value)) return 0.5;

  let count = 0;
  for (const item of valid) {
    if (item <= value) count += 1;
  }

  return count / valid.length;
};

export const calculateSectorPrimarySnapshot = (
  sectorPrices: number[],
  benchmarkPrices: number[]
): SectorPrimarySnapshot | null => {
  const { minLength, sector, benchmark, rsRaw } = rsRawSeries(sectorPrices, benchmarkPrices);
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

  if (sector.length <= RETURN_20D || benchmark.length <= RETURN_20D) return null;

  const currentSectorPrice = sector[sector.length - 1];
  const pastSectorPrice5 = sector[sector.length - 1 - RETURN_5D];
  const pastSectorPrice20 = sector[sector.length - 1 - RETURN_20D];
  const currentBenchPrice = benchmark[benchmark.length - 1];
  const pastBenchPrice5 = benchmark[benchmark.length - 1 - RETURN_5D];
  const pastBenchPrice20 = benchmark[benchmark.length - 1 - RETURN_20D];

  const ret5d = percentReturn(currentSectorPrice, pastSectorPrice5);
  const ret20d = percentReturn(currentSectorPrice, pastSectorPrice20);
  const benchRet5d = percentReturn(currentBenchPrice, pastBenchPrice5);
  const benchRet20d = percentReturn(currentBenchPrice, pastBenchPrice20);

  if (ret5d === null || ret20d === null || benchRet5d === null || benchRet20d === null) return null;

  const sectorDailyReturns = latestReturns(sector, VOL_WINDOW);
  const benchDailyReturns = latestReturns(benchmark, VOL_WINDOW);
  const sectorDailyReturns60 = latestReturns(sector, CORR_BETA_WINDOW);
  const benchDailyReturns60 = latestReturns(benchmark, CORR_BETA_WINDOW);

  if (!sectorDailyReturns || !benchDailyReturns || !sectorDailyReturns60 || !benchDailyReturns60) return null;

  const vol20d = standardDeviation(sectorDailyReturns) * Math.sqrt(252);
  const benchVol20d = standardDeviation(benchDailyReturns) * Math.sqrt(252);
  const corr60d = rollingCorrelation(sectorDailyReturns60, benchDailyReturns60, CORR_BETA_WINDOW);
  const beta60d = rollingBeta(sectorDailyReturns60, benchDailyReturns60, CORR_BETA_WINDOW);

  if (corr60d === null || beta60d === null) return null;

  const sectorPeak = Math.max(...sector.slice(-DD_WINDOW));
  if (!Number.isFinite(sectorPeak) || sectorPeak === 0) return null;

  const dd60d = (currentSectorPrice / sectorPeak) - 1.0;

  return {
    RS_Ratio: currentRatio,
    RS_Momentum: currentMomentum,
    Distance: currentDistance,
    Angle: currentAngle,
    Angular_Velocity: currentAngle - laggedAngle,
    Acceleration: currentDistance - laggedDistance,
    Ret_5d: ret5d,
    Vol_20d: vol20d,
    Excess_Ret_5d: ret5d - benchRet5d,
    Excess_Ret_20d: ret20d - benchRet20d,
    Corr_60d: corr60d,
    Beta_60d: beta60d,
    DD_60d: dd60d,
    Vol_Ratio: vol20d / (benchVol20d + 1e-9),
    Bench_Ret_20d: benchRet20d,
    Bench_Vol_20d: benchVol20d,
  };
};

export const toPrimaryFeatureVector = (
  snapshot: SectorPrimarySnapshot,
  ranks: SectorPrimaryRanks
): SectorPrimaryFeatureVector => [
  snapshot.RS_Ratio,
  snapshot.RS_Momentum,
  snapshot.Distance,
  snapshot.Angle,
  snapshot.Angular_Velocity,
  snapshot.Acceleration,
  snapshot.Ret_5d,
  snapshot.Vol_20d,
  snapshot.Excess_Ret_5d,
  snapshot.Excess_Ret_20d,
  snapshot.Corr_60d,
  snapshot.Beta_60d,
  snapshot.DD_60d,
  snapshot.Vol_Ratio,
  snapshot.Bench_Ret_20d,
  snapshot.Bench_Vol_20d,
  ranks.Rank_RS_Ratio,
  ranks.Rank_RS_Momentum,
  ranks.Rank_Excess_Ret_20d,
  ranks.Rank_Vol_20d,
];

export const rankPercentileValue = percentileRank;