export type ModelTask = 'binary_classification' | 'regression';
export type PolicyDecision = 'pass' | 'warn' | 'block';
export type CounterfactualStatus = 'feasible' | 'no_feasible_counterfactual';
export type ExplanationMethod = 'tree_shap' | 'model_agnostic_occlusion';

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number;
  method: 'bootstrap_percentile';
  samples: number;
  seed: number;
}

export interface FeatureDescriptor {
  key: string;
  displayName: string;
  unit?: string;
  redacted: boolean;
  protected: boolean;
  immutable: boolean;
}

export interface FeatureContribution {
  feature: string;
  displayName: string;
  unit?: string;
  contribution: number;
  rank: number;
}

export interface LocalExplanation {
  schemaVersion: 1;
  versionId: string;
  method: ExplanationMethod;
  task: ModelTask;
  baseValue: number;
  modelOutput: number;
  contributions: FeatureContribution[];
  additivityError: number;
  additivityPassed: boolean;
  durationMs: number;
  warnings: string[];
}

export interface ExplainRequest {
  features: Record<string, number | string | boolean | null>;
  timeoutMs?: number;
}

export interface GlobalImportance {
  feature: string;
  displayName: string;
  unit?: string;
  importance: number;
  rank: number;
}

export interface NumericFeatureConstraint {
  type: 'number';
  protected?: boolean;
  immutable?: boolean;
  minimum?: number;
  maximum?: number;
  step?: number;
  monotonic?: 'increase' | 'decrease' | 'none';
  costWeight?: number;
}

export interface CategoricalFeatureConstraint {
  type: 'category';
  protected?: boolean;
  immutable?: boolean;
  allowedValues: Array<string | number | boolean>;
  costWeight?: number;
}

export type FeatureConstraint = NumericFeatureConstraint | CategoricalFeatureConstraint;

export interface CounterfactualRequest {
  features: Record<string, number | string | boolean | null>;
  target: {
    operator: '>=' | '<=' | '>' | '<' | '==';
    value: number;
  };
  constraints: Record<string, FeatureConstraint>;
  maximumChangedFeatures?: number;
  maximumCandidates?: number;
  timeoutMs?: number;
}

export interface CounterfactualCandidate {
  features: Record<string, number | string | boolean | null>;
  changedFeatures: string[];
  modelOutput: number;
  verified: true;
  cost: number;
}

export interface CounterfactualResponse {
  schemaVersion: 1;
  versionId: string;
  status: CounterfactualStatus;
  candidates: CounterfactualCandidate[];
  searchedCandidates: number;
  durationMs: number;
  warnings: string[];
}

export interface ClassificationCohortMetrics {
  count: number;
  suppressed: boolean;
  suppressionReason?: 'minimum_cohort_size';
  selectionRate?: number;
  selectionRateInterval?: ConfidenceInterval;
  truePositiveRate?: number;
  falsePositiveRate?: number;
  falseNegativeRate?: number;
  trueNegativeRate?: number;
  calibrationError?: number;
}

export interface RegressionCohortMetrics {
  count: number;
  suppressed: boolean;
  suppressionReason?: 'minimum_cohort_size';
  meanAbsoluteError?: number;
  meanAbsoluteErrorInterval?: ConfidenceInterval;
  meanError?: number;
  errorStandardDeviation?: number;
  errorQuantiles?: {
    p05: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}

export interface CohortComparison {
  cohort: string;
  referenceGroup: string;
  status: 'computed' | 'suppressed' | 'not_computable';
  demographicParityDifference?: number;
  demographicParityRatio?: number;
  equalOpportunityDifference?: number;
  equalizedOddsDifference?: number;
  calibrationDifference?: number;
  meanAbsoluteErrorDifference?: number;
}

export interface FairnessEvaluation {
  task: ModelTask;
  referenceGroup: string;
  protectedAttribute: string;
  protectedAttributesUsedForPrediction: false;
  missingValueLabel: '__missing__';
  minimumCohortSize: number;
  cohorts: Record<string, ClassificationCohortMetrics | RegressionCohortMetrics>;
  comparisons: CohortComparison[];
  suppressedCohorts: string[];
  warnings: string[];
}

export interface ExplainabilityMetrics {
  method: ExplanationMethod;
  evaluatedRows: number;
  additivityPassRate: number;
  meanExplanationMs: number;
  p95ExplanationMs: number;
  maximumExplanationMs: number;
  tolerance: number;
}

export interface PromotionPolicy {
  schemaVersion: 1;
  minimumDatasetRows: number;
  minimumCohortSize: number;
  requiredMetrics: Record<string, string>;
  fairness: Record<string, string>;
  explainability: {
    additivityPassRate: string;
    maxP95ExplanationMs: number;
  };
  onFailure: 'block' | 'warn';
}

export interface PolicyCheck {
  name: string;
  actual: number | string[] | null;
  threshold: string;
  passed: boolean;
  reason?: 'metric_missing' | 'threshold_not_met' | 'suppressed_cohorts_cannot_pass';
}

export interface PolicyResult {
  schemaVersion: 1;
  passed: boolean;
  decision: PolicyDecision;
  checks: PolicyCheck[];
  policyHash: string;
  reportHash: string;
}

export interface ModelEvaluationReport {
  schemaVersion: 1;
  modelArtifactHash: string;
  datasetHash: string;
  codeCommit: string;
  datasetRows: number;
  metrics: Record<string, number>;
  fairness: Record<string, number | string[]>;
  explainability: {
    additivityPassRate: number;
    p95ExplanationMs: number;
  };
  policy: PromotionPolicy;
  modelCard?: Record<string, unknown>;
}

export interface RegisteredEvaluation {
  id: string;
  modelVersionId: string;
  schemaVersion: number;
  reportHash: string;
  policyHash: string;
  artifactHash: string;
  datasetHash: string;
  codeCommit: string;
  passed: boolean;
  decision: PolicyDecision;
  failureReasons: PolicyCheck[];
  createdAt: string;
}

export interface ModelCard {
  schemaVersion: 1;
  modelVersion: string;
  artifactHash: string;
  datasetHash: string;
  datasetLineage: string[];
  codeCommit: string;
  intendedUses: string[];
  prohibitedUses: string[];
  limitations: string;
  explanationMethod: ExplanationMethod;
  explanationLimitations: string;
  performance: Record<string, number>;
  cohortPerformance: Record<string, unknown>;
  policyResult: PolicyResult;
  approvedOverrides: PromotionOverride[];
  generatedAt: string;
  notice: string;
}

export interface PromotionOverride {
  id: string;
  actor: string;
  authorizedRole: 'admin' | 'ml_governance';
  reason: string;
  createdAt: string;
}

export interface GovernanceClientOptions {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class GovernanceApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'GovernanceApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
