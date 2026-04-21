export interface SectorIntelligence {
  primary: {
    probabilities: {
      down: number;
      neutral: number;
      up: number;
    };
    predictedClass: 0 | 1 | 2;
    predictedLabel: 'DOWN' | 'NEUTRAL' | 'UP';
    confidence: number;
    buyThreshold: number;
    sellThreshold: number;
    action: {
      label: 'BUY' | 'HOLD' | 'SELL';
      className: string;
      reason: string;
    };
  };
  legacy: {
    leadingProbability: number;
    anomalyScoreRaw: number;
    exhaustionRiskGauge: number;
  };
}

export interface SectorMlInput {
  primaryFeatures: number[];
  legacyFeatures: number[];
}

const MODEL_PRIMARY_PATH = '/model_sector_signal.onnx';
const MODEL_A_PATH = '/model_a_leading.onnx';
const MODEL_B_PATH = '/model_b_exhaustion.onnx';
const MODEL_PRIMARY_META_PATH = '/model_sector_signal_meta.json';
const ONNXRUNTIME_WEB_VERSION = '1.24.3';

const ANOMALY_MIN = -0.15;
const ANOMALY_MAX = 0.10;
const DEFAULT_BUY_THRESHOLD = 0.39;
const DEFAULT_SELL_THRESHOLD = 0.3712;
const SESSION_CACHE_KEY = 'ml:sector-intelligence:v1';

type PrimaryMeta = {
  buy_threshold_p_up?: number;
  sell_threshold_p_down?: number;
};

let ortModulePromise: Promise<any> | null = null;
let primarySessionPromise: Promise<any> | null = null;
let modelASessionPromise: Promise<any> | null = null;
let modelBSessionPromise: Promise<any> | null = null;
let primaryMetaPromise: Promise<PrimaryMeta | null> | null = null;
let inferenceCache: Record<string, SectorIntelligence> | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toRiskGauge = (rawAnomaly: number) => {
  const normalized = (rawAnomaly - ANOMALY_MIN) / (ANOMALY_MAX - ANOMALY_MIN);
  return clamp(normalized * 100, 0, 100);
};

const cacheKeyForInput = (input: SectorMlInput) => {
  const primary = input.primaryFeatures.map((v) => v.toFixed(6)).join(',');
  const legacy = input.legacyFeatures.map((v) => v.toFixed(6)).join(',');
  return `${primary}|${legacy}`;
};

const loadSessionCache = (): Record<string, SectorIntelligence> => {
  if (inferenceCache !== null) return inferenceCache;
  if (typeof window === 'undefined') {
    inferenceCache = {};
    return inferenceCache;
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    inferenceCache = raw ? JSON.parse(raw) : {};
  } catch {
    inferenceCache = {};
  }
  return inferenceCache ?? {};
};

const saveSessionCache = () => {
  if (typeof window === 'undefined' || inferenceCache === null) return;
  try {
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(inferenceCache));
  } catch {
    // Ignore quota/storage errors.
  }
};

const loadOrtRuntime = async () => {
  if (ortModulePromise) return ortModulePromise;
  ortModulePromise = import('onnxruntime-web/wasm').then((ort) => {
    // Keep threading conservative for browser compatibility.
    ort.env.wasm.numThreads = 1;
    // Force stable public wasm asset path to avoid dev-server chunk resolution issues.
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNXRUNTIME_WEB_VERSION}/dist/`;
    return ort;
  });
  return ortModulePromise;
};

const modelFileBytes = async (publicPath: string): Promise<Uint8Array> => {
  const response = await fetch(publicPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch model from ${publicPath}: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

const modelFileJson = async <T,>(publicPath: string): Promise<T> => {
  const response = await fetch(publicPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON from ${publicPath}: ${response.status}`);
  }
  return (await response.json()) as T;
};

const createSession = async (publicPath: string) => {
  const bytes = await modelFileBytes(publicPath);
  const ort = await loadOrtRuntime();
  return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
};

const getPrimarySession = () => {
  if (!primarySessionPromise) {
    primarySessionPromise = createSession(MODEL_PRIMARY_PATH).catch((error) => {
      primarySessionPromise = null;
      throw error;
    });
  }
  return primarySessionPromise;
};

const getModelASession = () => {
  if (!modelASessionPromise) {
    modelASessionPromise = createSession(MODEL_A_PATH).catch((error) => {
      modelASessionPromise = null;
      throw error;
    });
  }
  return modelASessionPromise;
};

const getModelBSession = () => {
  if (!modelBSessionPromise) {
    modelBSessionPromise = createSession(MODEL_B_PATH).catch((error) => {
      modelBSessionPromise = null;
      throw error;
    });
  }
  return modelBSessionPromise;
};

const getPrimaryMeta = () => {
  if (!primaryMetaPromise) {
    primaryMetaPromise = modelFileJson<PrimaryMeta>(MODEL_PRIMARY_META_PATH)
      .catch((error) => {
        primaryMetaPromise = null;
        throw error;
      }) as Promise<PrimaryMeta | null>;
  }
  return primaryMetaPromise;
};

export const warmupBrowserModels = async () => {
  await Promise.all([getPrimarySession(), getModelASession(), getModelBSession(), getPrimaryMeta()]);
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const isTensorLike = (value: unknown): value is { data: ArrayLike<number> } => {
  return typeof value === 'object' && value !== null && 'data' in value;
};

const tensorDataFromUnknownOutput = (value: unknown): number[] | null => {
  if (!isTensorLike(value)) return null;

  const data = Array.from(value.data as ArrayLike<number>)
    .map((entry) => asNumber(entry))
    .filter((entry): entry is number => entry !== null);

  return data.length > 0 ? data : null;
};

const extractPrimaryProbabilities = (allOutputs: any): number[] | null => {
  if (!allOutputs || typeof allOutputs !== 'object') return null;

  const candidateKeys = ['output_probability', 'probabilities', 'probability', 'output_probability_tensor'];
  for (const key of candidateKeys) {
    if (allOutputs[key]) {
      const values = tensorDataFromUnknownOutput(allOutputs[key]);
      if (values && values.length >= 3) return values.slice(0, 3);
    }
  }

  for (const value of Object.values(allOutputs)) {
    const values = tensorDataFromUnknownOutput(value);
    if (values && values.length >= 3) {
      return values.slice(0, 3);
    }
  }

  return null;
};

const extractModelAOutput = (allOutputs: any): number | null => {
  if (allOutputs.output_probability) {
    const prob = allOutputs.output_probability;
    if (prob?.data && prob.data.length >= 2) {
      return asNumber(prob.data[1]);
    }
    if (prob?.data && prob.data.length >= 1) {
      return asNumber(prob.data[0]);
    }
  }

  const firstKey = Object.keys(allOutputs)[0];
  if (firstKey && allOutputs[firstKey] && isTensorLike(allOutputs[firstKey])) {
    const tensorData = allOutputs[firstKey].data;
    if (tensorData.length >= 2) return asNumber(tensorData[1]);
    if (tensorData.length >= 1) return asNumber(tensorData[0]);
  }

  if (allOutputs.output_label?.data && allOutputs.output_label.data.length >= 1) {
    const label = asNumber(allOutputs.output_label.data[0]);
    if (label === 0 || label === 1) return label;
  }

  return null;
};

const extractModelBOutput = (allOutputs: any): number | null => {
  if (allOutputs.scores?.data && allOutputs.scores.data.length >= 1) {
    return asNumber(allOutputs.scores.data[0]);
  }

  if (allOutputs.label?.data && allOutputs.label.data.length >= 1) {
    return asNumber(allOutputs.label.data[0]);
  }

  const firstKey = Object.keys(allOutputs)[0];
  if (firstKey && allOutputs[firstKey] && isTensorLike(allOutputs[firstKey])) {
    return asNumber(allOutputs[firstKey].data[0]);
  }

  return null;
};

const derivePrimaryAction = (
  probabilities: number[],
  buyThreshold: number,
  sellThreshold: number,
  legacyRisk: number
) => {
  const down = probabilities[0] ?? 0;
  const up = probabilities[2] ?? 0;

  if (up >= buyThreshold && down < sellThreshold && legacyRisk < 60) {
    return {
      label: 'BUY' as const,
      className: 'text-emerald-300 border-emerald-600/40 bg-emerald-950/35',
      reason: 'Upside probability is high while downside risk stays contained.',
    };
  }

  if (down >= sellThreshold && up < buyThreshold) {
    return {
      label: 'SELL' as const,
      className: 'text-rose-300 border-rose-600/40 bg-rose-950/30',
      reason: 'Downside probability is high and upside conviction is weak.',
    };
  }

  if (legacyRisk >= 75 && up < buyThreshold) {
    return {
      label: 'SELL' as const,
      className: 'text-rose-300 border-rose-600/40 bg-rose-950/30',
      reason: 'The sector looks stretched, so conviction is reduced even if the direction is not outright bearish.',
    };
  }

  if (up >= buyThreshold && legacyRisk >= 60) {
    return {
      label: 'HOLD' as const,
      className: 'text-cyan-300 border-cyan-600/40 bg-cyan-950/30',
      reason: 'Upside is present, but the legacy stretch model warns against aggressive buying.',
    };
  }

  return {
    label: 'HOLD' as const,
    className: 'text-cyan-300 border-cyan-600/40 bg-cyan-950/30',
    reason: 'Signals are mixed, so wait for a clearer directional edge.',
  };
};

export const getSectorIntelligenceInBrowser = async (input: SectorMlInput): Promise<SectorIntelligence> => {
  if (input.primaryFeatures.length !== 20) {
    throw new Error(`Expected 20 primary features, received ${input.primaryFeatures.length}`);
  }
  if (input.legacyFeatures.length !== 8) {
    throw new Error(`Expected 8 legacy features, received ${input.legacyFeatures.length}`);
  }

  const cache = loadSessionCache();
  const key = cacheKeyForInput(input);
  if (cache[key]) return cache[key];

  const [primaryModel, modelA, modelB, meta] = await Promise.all([
    getPrimarySession(),
    getModelASession(),
    getModelBSession(),
    getPrimaryMeta(),
  ]);

  const ort = await loadOrtRuntime();
  const primaryTensor = new ort.Tensor('float32', Float32Array.from(input.primaryFeatures), [1, 20]);
  const legacyTensor = new ort.Tensor('float32', Float32Array.from(input.legacyFeatures), [1, 8]);

  const [primaryOutputs, modelAOutputs, modelBOutputs] = await Promise.all([
    primaryModel.run({ float_input: primaryTensor }),
    modelA.run({ float_input: legacyTensor }, ['output_label']),
    modelB.run({ float_input: legacyTensor }, ['scores']),
  ]);

  const probabilities = extractPrimaryProbabilities(primaryOutputs);
  if (!probabilities) {
    throw new Error('Unable to parse primary probabilities from browser inference output');
  }

  const leadingProbability = extractModelAOutput(modelAOutputs);
  const anomalyScoreRaw = extractModelBOutput(modelBOutputs);

  if (leadingProbability === null) {
    throw new Error('Unable to parse model A output');
  }
  if (anomalyScoreRaw === null) {
    throw new Error('Unable to parse model B output');
  }

  const buyThreshold = meta?.buy_threshold_p_up ?? DEFAULT_BUY_THRESHOLD;
  const sellThreshold = meta?.sell_threshold_p_down ?? DEFAULT_SELL_THRESHOLD;
  const confidence = Math.max(...probabilities);
  const predictedClass = probabilities[0] >= probabilities[1] && probabilities[0] >= probabilities[2]
    ? 0
    : probabilities[1] >= probabilities[0] && probabilities[1] >= probabilities[2]
      ? 1
      : 2;
  const predictedLabel = predictedClass === 0 ? 'DOWN' : predictedClass === 1 ? 'NEUTRAL' : 'UP';
  const legacyRisk = toRiskGauge(anomalyScoreRaw);

  const output: SectorIntelligence = {
    primary: {
      probabilities: {
        down: clamp(probabilities[0], 0, 1),
        neutral: clamp(probabilities[1], 0, 1),
        up: clamp(probabilities[2], 0, 1),
      },
      predictedClass: predictedClass as 0 | 1 | 2,
      predictedLabel,
      confidence: clamp(confidence, 0, 1),
      buyThreshold,
      sellThreshold,
      action: derivePrimaryAction(probabilities, buyThreshold, sellThreshold, legacyRisk),
    },
    legacy: {
      leadingProbability: clamp(leadingProbability, 0, 1),
      anomalyScoreRaw,
      exhaustionRiskGauge: legacyRisk,
    },
  };

  cache[key] = output;
  saveSessionCache();
  return output;
};

export const enrichSectorsWithBrowserMl = async <T extends { name?: string; ml?: any; mlInput?: SectorMlInput | null }>(
  sectors: T[]
): Promise<T[]> => {
  if (!Array.isArray(sectors) || sectors.length === 0) return sectors;

  await warmupBrowserModels();

  const enriched = await Promise.all(
    sectors.map(async (sector) => {
      if (sector?.ml?.primary && sector?.ml?.legacy) return sector;
      if (!sector?.mlInput) return sector;

      try {
        const intelligence = await getSectorIntelligenceInBrowser(sector.mlInput);
        return {
          ...sector,
          ml: {
            ...intelligence,
            primaryFeatures: sector.mlInput.primaryFeatures,
            legacyFeatures: sector.mlInput.legacyFeatures,
          },
          mlStatus: {
            status: 'ok-client',
            reason: 'Inference completed in browser session',
          },
        } as T;
      } catch (error: any) {
        return {
          ...sector,
          mlStatus: {
            status: 'failed-client',
            reason: error?.message || String(error),
          },
        } as T;
      }
    })
  );

  return enriched;
};
