import { requestSettingsApi } from './settingsApi';

const API_BASE = '/api/v2/ml-models';

export interface MLModel {
  id: string;
  name: string;
  description: string;
  taskType: string;
  createdAt: string;
}

export interface MLModelVersion {
  id: string;
  modelId: string;
  version: string;
  stage: 'staging' | 'production' | 'archived';
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
  auc: number | null;
  createdAt: string;
  promotedAt: string | null;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  modelVersionId: string;
  name: string;
  isControl: boolean;
  trafficWeight: number;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string;
  modelId: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'rolled_back';
  metric: string;
  significanceLevel: number;
  power: number;
  minimumDetectableEffect: number | null;
  bonferroniCorrection: boolean;
  createdAt: string;
  variants?: ExperimentVariant[];
}

export interface SignificanceResult {
  pValue: number;
  zScore: number;
  significant: boolean;
  alpha: number;
  controlRate: number;
  variantRate: number;
  relativeUplift: number;
  confidenceInterval: { lower: number; upper: number; confidenceLevel: number };
}

export interface VariantResult {
  variant: ExperimentVariant;
  exposures: number;
  conversions: number;
  conversionRate: number;
  significance?: SignificanceResult;
}

export interface ExperimentResults {
  experiment: Experiment;
  control: VariantResult;
  treatments: VariantResult[];
  powerAnalysis: {
    requiredSampleSizePerVariant: number;
    minimumDetectableEffect: number;
    baselineRate: number;
    power: number;
    alpha: number;
  } | null;
  readyForDecision: boolean;
}

export const listModels = () => requestSettingsApi<{ success: boolean; data: MLModel[] }>({
  url: `${API_BASE}`,
  method: 'GET',
}).then((r) => r.data);

export const listExperiments = () => requestSettingsApi<{ success: boolean; data: Experiment[] }>({
  url: `${API_BASE}/experiments`,
  method: 'GET',
}).then((r) => r.data);

export const getExperiment = (experimentId: string) =>
  requestSettingsApi<{ success: boolean; data: Experiment }>({
    url: `${API_BASE}/experiments/${experimentId}`,
    method: 'GET',
  }).then((r) => r.data);

export const getExperimentResults = (experimentId: string) =>
  requestSettingsApi<{ success: boolean; data: ExperimentResults }>({
    url: `${API_BASE}/experiments/${experimentId}/results`,
    method: 'GET',
  }).then((r) => r.data);

export const listModelVersions = (modelId: string) =>
  requestSettingsApi<{ success: boolean; data: MLModelVersion[] }>({
    url: `${API_BASE}/${modelId}/versions`,
    method: 'GET',
  }).then((r) => r.data);

export const rollbackModel = (modelId: string, targetVersionId: string, actor: string) =>
  requestSettingsApi<{ success: boolean; data: MLModelVersion }>({
    url: `${API_BASE}/${modelId}/rollback`,
    method: 'POST',
    data: { targetVersionId, actor },
  }).then((r) => r.data);

export const startExperiment = (experimentId: string) =>
  requestSettingsApi<{ success: boolean; data: Experiment }>({
    url: `${API_BASE}/experiments/${experimentId}/start`,
    method: 'POST',
  }).then((r) => r.data);

export const pauseExperiment = (experimentId: string) =>
  requestSettingsApi<{ success: boolean; data: Experiment }>({
    url: `${API_BASE}/experiments/${experimentId}/pause`,
    method: 'POST',
  }).then((r) => r.data);
