// Use Node.js runtime on server, web runtime in browser
let ortModulePromise: Promise<any> | null = null;

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
  leadingProbability: number;
  anomalyScoreRaw: number;
  exhaustionRiskGauge: number;
}

const MODEL_PRIMARY_PATH = '/model_sector_signal.onnx';
const MODEL_A_PATH = '/model_a_leading.onnx';
const MODEL_B_PATH = '/model_b_exhaustion.onnx';
const MODEL_PRIMARY_META_PATH = '/model_sector_signal_meta.json';

// Trained score envelope provided by your model training notes.
const ANOMALY_MIN = -0.15;
const ANOMALY_MAX = 0.10;
const DEFAULT_BUY_THRESHOLD = 0.39;
const DEFAULT_SELL_THRESHOLD = 0.3712;

let primarySessionPromise: Promise<any> | null = null;
let modelASessionPromise: Promise<any> | null = null;
let modelBSessionPromise: Promise<any> | null = null;
type PrimaryMeta = {
  feature_order?: string[];
  class_mapping?: Record<string, string>;
  horizon_days?: number;
  buy_threshold_p_up?: number;
  sell_threshold_p_down?: number;
};

let primaryMetaPromise: Promise<PrimaryMeta | null> | null = null;

const loadOrtRuntime = async () => {
  if (ortModulePromise) return ortModulePromise;
  ortModulePromise = (async () => {
    if (typeof window === 'undefined') {
      return import('onnxruntime-node');
    } else {
      return import('onnxruntime-web');
    }
  })();
  return ortModulePromise;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toRiskGauge = (rawAnomaly: number) => {
  const normalized = (rawAnomaly - ANOMALY_MIN) / (ANOMALY_MAX - ANOMALY_MIN);
  return clamp(normalized * 100, 0, 100);
};

const modelFileBytes = async (publicPath: string): Promise<Uint8Array> => {
  if (typeof window !== 'undefined') {
    const response = await fetch(publicPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch ONNX model from ${publicPath}: ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');

  const absolutePath = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  const bytes = await readFile(absolutePath);
  return new Uint8Array(bytes);
};

const modelFileJson = async <T,>(publicPath: string): Promise<T> => {
  if (typeof window !== 'undefined') {
    const response = await fetch(publicPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON from ${publicPath}: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');

  const absolutePath = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  const text = await readFile(absolutePath, 'utf8');
  return JSON.parse(text) as T;
};

const createSession = async (publicPath: string) => {
  const bytes = await modelFileBytes(publicPath);
  const ort = await loadOrtRuntime();
  if (typeof window === 'undefined') {
    return ort.InferenceSession.create(bytes);
  }

  return ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
  });
};

const getModelASession = () => {
  if (!modelASessionPromise) {
    modelASessionPromise = createSession(MODEL_A_PATH);
  }
  return modelASessionPromise;
};

const getPrimarySession = () => {
  if (!primarySessionPromise) {
    primarySessionPromise = createSession(MODEL_PRIMARY_PATH);
  }
  return primarySessionPromise;
};

const getModelBSession = () => {
  if (!modelBSessionPromise) {
    modelBSessionPromise = createSession(MODEL_B_PATH);
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

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const isTensorLike = (value: unknown): value is { data: ArrayLike<number> } => {
  return typeof value === 'object' && value !== null && 'data' in value;
};

const scalarFromTensor = (tensor: any): number | null => {
  const data = tensor.data as ArrayLike<number>;
  if (!data || data.length === 0) return null;

  const first = asNumber(data[0]);
  return first;
};

const tensorDataFromUnknownOutput = (value: unknown): number[] | null => {
  if (!isTensorLike(value)) return null;

  const data = Array.from(value.data as ArrayLike<number>)
    .map((entry) => asNumber(entry))
    .filter((entry): entry is number => entry !== null);

  return data.length > 0 ? data : null;
};

const probabilityFromTensor = (tensor: any): number | null => {
  const data = tensor.data as ArrayLike<number>;
  if (!data || data.length === 0) return null;

  // Common sklearn output shape is [1,2], where index 1 is class-1 probability.
  if (data.length >= 2) {
    const class1 = asNumber(data[1]);
    if (class1 !== null) return class1;
  }

  const scalar = asNumber(data[0]);
  return scalar;
};

const probabilityFromUnknownOutput = (value: unknown): number | null => {
  if (isTensorLike(value)) {
    return probabilityFromTensor(value);
  }

  if (value instanceof Map) {
    const class1 = asNumber(value.get(1)) ?? asNumber(value.get('1'));
    if (class1 !== null) return class1;

    for (const entry of value.values()) {
      const numeric = asNumber(entry);
      if (numeric !== null) return numeric;
    }
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const class1 = asNumber(obj['1']);
    if (class1 !== null) return class1;

    for (const entry of Object.values(obj)) {
      const numeric = asNumber(entry);
      if (numeric !== null) return numeric;
    }
  }

  return null;
};

const scalarFromUnknownOutput = (value: unknown): number | null => {
  if (isTensorLike(value)) {
    return scalarFromTensor(value);
  }

  if (value instanceof Map) {
    for (const entry of value.values()) {
      const numeric = asNumber(entry);
      if (numeric !== null) return numeric;
    }
  }

  if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      const numeric = asNumber(entry);
      if (numeric !== null) return numeric;
    }
  }

  return asNumber(value);
};

const assertFeatureVector = (features: number[]) => {
  if (features.length !== 8) {
    throw new Error(`Expected 8 features, received ${features.length}`);
  }

  for (let i = 0; i < features.length; i++) {
    if (!Number.isFinite(features[i])) {
      throw new Error(`Feature at index ${i} is not finite`);
    }
  }
};

export const warmupSectorModels = async () => {
  await Promise.all([getPrimarySession(), getModelASession(), getModelBSession(), getPrimaryMeta()]);
};

export const getSectorIntelligence = async ({
  primaryFeatures,
  legacyFeatures,
}: {
  primaryFeatures: number[];
  legacyFeatures: number[];
}): Promise<SectorIntelligence> => {
  assertFeatureVector(legacyFeatures);
  if (primaryFeatures.length !== 20) {
    throw new Error(`Expected 20 primary features, received ${primaryFeatures.length}`);
  }

  for (let i = 0; i < primaryFeatures.length; i++) {
    if (!Number.isFinite(primaryFeatures[i])) {
      throw new Error(`Primary feature at index ${i} is not finite`);
    }
  }

  const [primaryModel, modelA, modelB, meta] = await Promise.all([
    getPrimarySession(),
    getModelASession(),
    getModelBSession(),
    getPrimaryMeta(),
  ]);
  const ort = await loadOrtRuntime();
  const legacyTensor = new ort.Tensor('float32', Float32Array.from(legacyFeatures), [1, 8]);
  const primaryTensor = new ort.Tensor('float32', Float32Array.from(primaryFeatures), [1, 20]);

  const [primaryOutputs, modelAOutputs, modelBOutputs] = await Promise.all([
    primaryModel.run({ float_input: primaryTensor }),
    modelA.run({ float_input: legacyTensor }, ['output_label']),
    modelB.run({ float_input: legacyTensor }, ['scores']),
  ]);

  const primaryProbabilities = extractPrimaryProbabilities(primaryOutputs);
  if (primaryProbabilities === null) {
    throw new Error('Unable to parse primary probabilities from model_sector_signal.onnx output');
  }

  const buyThreshold = meta?.buy_threshold_p_up ?? DEFAULT_BUY_THRESHOLD;
  const sellThreshold = meta?.sell_threshold_p_down ?? DEFAULT_SELL_THRESHOLD;

  const predictedClass = primaryProbabilities[0] >= primaryProbabilities[1] && primaryProbabilities[0] >= primaryProbabilities[2]
    ? 0
    : primaryProbabilities[1] >= primaryProbabilities[0] && primaryProbabilities[1] >= primaryProbabilities[2]
      ? 1
      : 2;

  const predictedLabel = predictedClass === 0 ? 'DOWN' : predictedClass === 1 ? 'NEUTRAL' : 'UP';
  const confidence = Math.max(...primaryProbabilities);

  // Model A returns [output_label, output_probability]
  const leadingProbability = extractModelAOutput(modelAOutputs);

  // Model B returns [label, scores]
  const anomalyScoreRaw = extractModelBOutput(modelBOutputs);

  if (leadingProbability === null) {
    throw new Error('Unable to parse class-1 probability from model_a_leading.onnx output');
  }

  if (anomalyScoreRaw === null) {
    throw new Error('Unable to parse anomaly score from model_b_exhaustion.onnx output');
  }

  const legacyRisk = toRiskGauge(anomalyScoreRaw);
  const action = derivePrimaryAction(primaryProbabilities, buyThreshold, sellThreshold, legacyRisk);

  return {
    primary: {
      probabilities: {
        down: clamp(primaryProbabilities[0], 0, 1),
        neutral: clamp(primaryProbabilities[1], 0, 1),
        up: clamp(primaryProbabilities[2], 0, 1),
      },
      predictedClass: predictedClass as 0 | 1 | 2,
      predictedLabel,
      confidence: clamp(confidence, 0, 1),
      buyThreshold,
      sellThreshold,
      action,
    },
    legacy: {
      leadingProbability: clamp(leadingProbability, 0, 1),
      anomalyScoreRaw,
      exhaustionRiskGauge: legacyRisk,
    },
    leadingProbability: clamp(leadingProbability, 0, 1),
    anomalyScoreRaw,
    exhaustionRiskGauge: legacyRisk,
  };
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
  // Try output_probability first (list/tensor with class probs)
  if (allOutputs.output_probability) {
    const prob = allOutputs.output_probability;
    if (prob?.data && prob.data.length >= 2) {
      return asNumber(prob.data[1]);
    }
    if (prob?.data && prob.data.length >= 1) {
      return asNumber(prob.data[0]);
    }
  }

  // Fallback to first output
  const firstKey = Object.keys(allOutputs)[0];
  if (firstKey && allOutputs[firstKey]) {
    return probabilityFromUnknownOutput(allOutputs[firstKey]);
  }

  // Compatibility fallback for ZipMap exports where JS runtimes cannot read output_probability.
  // In this case output_label is available as int64 (0/1). Use it as coarse probability.
  if (allOutputs.output_label?.data && allOutputs.output_label.data.length >= 1) {
    const label = asNumber(allOutputs.output_label.data[0]);
    if (label === 0 || label === 1) return label;
  }

  return null;
};

const extractModelBOutput = (allOutputs: any): number | null => {
  // Try scores first (contains raw anomaly values)
  if (allOutputs.scores) {
    const scores = allOutputs.scores;
    if (scores?.data && scores.data.length >= 1) {
      return asNumber(scores.data[0]);
    }
  }

  // Fallback to label
  if (allOutputs.label) {
    const label = allOutputs.label;
    if (label?.data && label.data.length >= 1) {
      return asNumber(label.data[0]);
    }
  }

  // Generic fallback
  const firstKey = Object.keys(allOutputs)[0];
  if (firstKey) {
    return scalarFromUnknownOutput(allOutputs[firstKey]);
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
