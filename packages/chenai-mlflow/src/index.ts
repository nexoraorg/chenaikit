// @chenaikit/chenai-mlflow — ML experiment tracking integration.
//
// This module is the machine-readable half of the ML pipeline data contract.
// The prose half — units, provenance and the rationale behind every
// missing-value rule — lives in `ml/README.md`. The two are meant to be read
// together: `ml/README.md` explains *why*, the specs below enforce *what*.

export const VERSION = "0.1.0";

/** Schema version of the {@link FeatureVector} contract (semver). */
export const FEATURE_VECTOR_SCHEMA_VERSION = "1.0.0";

/** Schema version of the {@link ModelResult} contract (semver). */
export const MODEL_RESULT_SCHEMA_VERSION = "1.0.0";

/**
 * Stroops per XLM. All monetary feature fields are integer stroops so that no
 * value in the pipeline ever depends on binary floating-point rounding.
 */
export const STROOPS_PER_XLM = 10_000_000;

// ---------------------------------------------------------------------------
// Feature vector (pipeline input)
// ---------------------------------------------------------------------------

/** What the feature vector describes: a Stellar account, or a single payment. */
export type SubjectKind = "account" | "transaction";

/**
 * Customer due-diligence level known to the caller at feature-build time.
 * `0` = unverified. This is never `null`: the caller always knows the tier it
 * has on file, and "unverified" is exactly what tier `0` means.
 */
export type KycTier = 0 | 1 | 2 | 3;

/** Names of the nullable numeric features. */
export type NumericFeatureName =
  | "accountAgeDays"
  | "transactionCount30d"
  | "averageBalanceStroops"
  | "largestTransferStroops"
  | "distinctCounterparties30d"
  | "failedPaymentCount90d"
  | "disputeRatio90d"
  | "crossBorderTransferRatio30d"
  | "medianSettlementLatencySeconds";

/**
 * Declarative spec for one numeric feature. The validator and the imputer are
 * both driven off these records, so the documented contract and the enforced
 * contract cannot drift apart.
 */
export interface NumericFeatureSpec {
  /** Field name as it appears on {@link FeatureVector}. */
  readonly name: NumericFeatureName;
  /** Physical unit, for documentation and for downstream unit assertions. */
  readonly unit: "days" | "count" | "stroops" | "ratio" | "seconds";
  /** Whether the field must be an integer (counts and stroops) or may be fractional. */
  readonly integer: boolean;
  /** Inclusive lower bound. */
  readonly min: number;
  /** Inclusive upper bound. */
  readonly max: number;
  /** Value substituted by {@link imputeFeatureVector} when the field is `null`. */
  readonly missingDefault: number;
  /** Human-readable meaning, mirrored in `ml/README.md`. */
  readonly description: string;
}

/**
 * The nullable numeric features, in canonical order.
 *
 * Imputation defaults lean toward the risk-averse reading of "unknown" rather
 * than mechanically toward zero — see `medianSettlementLatencySeconds`, where
 * `0` would falsely claim instant settlement.
 */
export const NUMERIC_FEATURE_SPECS: readonly NumericFeatureSpec[] = [
  {
    name: "accountAgeDays",
    unit: "days",
    integer: true,
    min: 0,
    max: 36_500,
    missingDefault: 0,
    description:
      "Whole days between account creation and observedAt. Unknown age is treated as a brand-new account.",
  },
  {
    name: "transactionCount30d",
    unit: "count",
    integer: true,
    min: 0,
    max: 1_000_000_000,
    missingDefault: 0,
    description: "Settled payments in the 30 days ending at observedAt.",
  },
  {
    name: "averageBalanceStroops",
    unit: "stroops",
    integer: true,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    missingDefault: 0,
    description:
      "Time-weighted mean native balance over the 30 days ending at observedAt, in stroops.",
  },
  {
    name: "largestTransferStroops",
    unit: "stroops",
    integer: true,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    missingDefault: 0,
    description:
      "Largest single outbound payment in the 30 days ending at observedAt, in stroops.",
  },
  {
    name: "distinctCounterparties30d",
    unit: "count",
    integer: true,
    min: 0,
    max: 1_000_000_000,
    missingDefault: 0,
    description:
      "Distinct counterparty accounts transacted with in the 30 days ending at observedAt.",
  },
  {
    name: "failedPaymentCount90d",
    unit: "count",
    integer: true,
    min: 0,
    max: 1_000_000_000,
    missingDefault: 0,
    description:
      "Submitted payments that failed or were reverted in the 90 days ending at observedAt.",
  },
  {
    name: "disputeRatio90d",
    unit: "ratio",
    integer: false,
    min: 0,
    max: 1,
    missingDefault: 0,
    description:
      "Disputed payments divided by total payments over the 90 days ending at observedAt.",
  },
  {
    name: "crossBorderTransferRatio30d",
    unit: "ratio",
    integer: false,
    min: 0,
    max: 1,
    missingDefault: 0,
    description:
      "Share of 30-day payment volume whose counterparty anchor is in a different jurisdiction.",
  },
  {
    name: "medianSettlementLatencySeconds",
    unit: "seconds",
    integer: false,
    min: 0,
    max: 2_592_000,
    missingDefault: 86_400,
    description:
      "Median seconds from submission to ledger close over the 30 days ending at observedAt. Unknown latency imputes to one day, never to zero.",
  },
] as const;

/**
 * A single scored subject, as handed to a model.
 *
 * Missing-value convention: every numeric feature is `number | null`, where
 * `null` means "the upstream source had no value". The key must still be
 * present — an absent key is a producer bug and is rejected, not silently
 * treated as `null`.
 */
export interface FeatureVector {
  /** Semver of this contract; must equal {@link FEATURE_VECTOR_SCHEMA_VERSION}. */
  schemaVersion: string;
  /** Opaque pseudonymous identifier. `[A-Za-z0-9_-]{1,128}` — never PII. */
  subjectId: string;
  /** Whether `subjectId` names an account or a single payment. */
  subjectKind: SubjectKind;
  /** ISO-8601 UTC instant the features were computed as of, e.g. `2026-01-15T00:00:00.000Z`. */
  observedAt: string;
  /** Customer due-diligence tier. Required — see {@link KycTier}. */
  kycTier: KycTier;

  /** Whole days since account creation. Unit: days. `null` = unknown. */
  accountAgeDays: number | null;
  /** Settled payments in the trailing 30 days. Unit: count. `null` = unknown. */
  transactionCount30d: number | null;
  /** Time-weighted mean native balance. Unit: stroops. `null` = unknown. */
  averageBalanceStroops: number | null;
  /** Largest single outbound payment in 30 days. Unit: stroops. `null` = unknown. */
  largestTransferStroops: number | null;
  /** Distinct counterparties in 30 days. Unit: count. `null` = unknown. */
  distinctCounterparties30d: number | null;
  /** Failed or reverted payments in 90 days. Unit: count. `null` = unknown. */
  failedPaymentCount90d: number | null;
  /** Disputed / total payments over 90 days. Unit: ratio in [0,1]. `null` = unknown. */
  disputeRatio90d: number | null;
  /** Cross-border share of 30-day volume. Unit: ratio in [0,1]. `null` = unknown. */
  crossBorderTransferRatio30d: number | null;
  /** Median submit-to-close latency over 30 days. Unit: seconds. `null` = unknown. */
  medianSettlementLatencySeconds: number | null;
}

/**
 * A {@link FeatureVector} with every `null` replaced by its documented default.
 * This — not the raw vector — is what a model consumes.
 */
export type ImputedFeatureVector = Omit<FeatureVector, NumericFeatureName> & {
  readonly [K in NumericFeatureName]: number;
} & {
  /** Feature names that were `null` and have been filled with their default. */
  readonly imputedFields: readonly NumericFeatureName[];
};

// ---------------------------------------------------------------------------
// Model result (pipeline output)
// ---------------------------------------------------------------------------

/** Which head produced the result. Mirrors the Soroban contracts of the same name. */
export type ModelTask = "credit-score" | "fraud-detect";

/** Discrete class emitted alongside the continuous score. */
export type RiskLabel = "low" | "medium" | "high";

/**
 * A model's verdict on one subject.
 *
 * No field is nullable. A model that cannot score a subject emits *no*
 * `ModelResult` at all and records the failure out of band — a partially
 * populated result must never reach the chain, because downstream Soroban
 * contracts cannot distinguish "unknown" from "benign".
 */
export interface ModelResult {
  /** Semver of this contract; must equal {@link MODEL_RESULT_SCHEMA_VERSION}. */
  schemaVersion: string;
  /** Stable model identifier, e.g. `credit-score-gbm`. `[A-Za-z0-9._-]{1,128}`. */
  modelId: string;
  /** Semver of the trained artifact that produced this result. */
  modelVersion: string;
  /** `schemaVersion` of the {@link FeatureVector} that was scored. */
  featureVectorVersion: string;
  /** Which head produced the result. */
  task: ModelTask;
  /** Echoes {@link FeatureVector.subjectId}. */
  subjectId: string;
  /** ISO-8601 UTC instant the score was produced. */
  scoredAt: string;
  /** Continuous risk score. Unit: ratio in [0,1]; higher = riskier. */
  score: number;
  /** Discrete bucket derived from `score` via the model's calibrated thresholds. */
  label: RiskLabel;
  /** Calibrated confidence in `label`. Unit: ratio in [0,1]. */
  confidence: number;
  /** Feature names that were imputed on the way in. Empty when nothing was missing. */
  imputedFields: NumericFeatureName[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Raised when a payload does not satisfy a documented contract. */
export class SchemaValidationError extends Error {
  /** Every violation found, not just the first. */
  readonly issues: readonly string[];
  /** Name of the contract that rejected the payload. */
  readonly schema: string;

  constructor(schema: string, issues: readonly string[]) {
    super(`${schema} validation failed: ${issues.join("; ")}`);
    this.name = "SchemaValidationError";
    this.schema = schema;
    this.issues = issues;
    Object.setPrototypeOf(this, SchemaValidationError.prototype);
  }
}

const SUBJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const SUBJECT_KINDS: readonly SubjectKind[] = ["account", "transaction"];
const KYC_TIERS: readonly KycTier[] = [0, 1, 2, 3];
const MODEL_TASKS: readonly ModelTask[] = ["credit-score", "fraud-detect"];
const RISK_LABELS: readonly RiskLabel[] = ["low", "medium", "high"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkTimestamp(
  issues: string[],
  record: Record<string, unknown>,
  field: string,
): void {
  const value = record[field];
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) {
    issues.push(`${field} must be an ISO-8601 UTC timestamp ending in "Z"`);
    return;
  }
  if (Number.isNaN(Date.parse(value))) {
    issues.push(`${field} is not a real calendar instant`);
  }
}

function checkString(
  issues: string[],
  record: Record<string, unknown>,
  field: string,
  pattern: RegExp,
  expectation: string,
): void {
  const value = record[field];
  if (typeof value !== "string") {
    issues.push(`${field} must be a string`);
  } else if (!pattern.test(value)) {
    issues.push(`${field} must ${expectation}`);
  }
}

function checkEnum<T>(
  issues: string[],
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): void {
  if (!allowed.includes(record[field] as T)) {
    issues.push(
      `${field} must be one of ${allowed.map((v) => JSON.stringify(v)).join(", ")}`,
    );
  }
}

function checkBoundedNumber(
  issues: string[],
  record: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): void {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${field} must be a finite number`);
  } else if (value < min || value > max) {
    issues.push(`${field} must be within [${min}, ${max}], got ${value}`);
  }
}

/**
 * Validate an untrusted payload against the {@link FeatureVector} contract.
 *
 * Rejects, with every issue listed: unknown or absent keys, `undefined` in
 * place of an explicit `null`, `NaN`/`Infinity`, fractional values in integer
 * fields, out-of-range values, a `subjectId` that looks like PII (anything
 * outside `[A-Za-z0-9_-]`, which excludes emails and account addresses with
 * punctuation), and a `schemaVersion` this build does not implement.
 *
 * @throws {SchemaValidationError}
 */
export function validateFeatureVector(input: unknown): FeatureVector {
  const issues: string[] = [];

  if (!isPlainObject(input)) {
    throw new SchemaValidationError("FeatureVector", [
      "payload must be a plain object",
    ]);
  }

  const known = new Set<string>([
    "schemaVersion",
    "subjectId",
    "subjectKind",
    "observedAt",
    "kycTier",
    ...NUMERIC_FEATURE_SPECS.map((spec) => spec.name),
  ]);
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      issues.push(`unknown field ${JSON.stringify(key)}`);
    }
  }

  checkString(
    issues,
    input,
    "schemaVersion",
    SEMVER_PATTERN,
    "be a semver string such as \"1.0.0\"",
  );
  if (
    typeof input.schemaVersion === "string" &&
    SEMVER_PATTERN.test(input.schemaVersion) &&
    input.schemaVersion !== FEATURE_VECTOR_SCHEMA_VERSION
  ) {
    issues.push(
      `schemaVersion ${input.schemaVersion} is not supported by this build (expected ${FEATURE_VECTOR_SCHEMA_VERSION})`,
    );
  }

  checkString(
    issues,
    input,
    "subjectId",
    SUBJECT_ID_PATTERN,
    "be an opaque pseudonymous id matching [A-Za-z0-9_-]{1,128} and must not carry personal data",
  );
  checkEnum(issues, input, "subjectKind", SUBJECT_KINDS);
  checkTimestamp(issues, input, "observedAt");
  checkEnum(issues, input, "kycTier", KYC_TIERS);

  for (const spec of NUMERIC_FEATURE_SPECS) {
    if (!Object.prototype.hasOwnProperty.call(input, spec.name)) {
      issues.push(
        `${spec.name} is required; use an explicit null to signal a missing value`,
      );
      continue;
    }

    const value = input[spec.name];
    if (value === null) continue;

    if (value === undefined) {
      issues.push(
        `${spec.name} must not be undefined; use an explicit null to signal a missing value`,
      );
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(
        `${spec.name} must be a finite number or null (unit: ${spec.unit})`,
      );
      continue;
    }
    if (spec.integer && !Number.isInteger(value)) {
      issues.push(`${spec.name} must be an integer (unit: ${spec.unit})`);
      continue;
    }
    if (value < spec.min || value > spec.max) {
      issues.push(
        `${spec.name} must be within [${spec.min}, ${spec.max}], got ${value}`,
      );
    }
  }

  if (issues.length > 0) {
    throw new SchemaValidationError("FeatureVector", issues);
  }
  return input as unknown as FeatureVector;
}

/** Non-throwing type guard over {@link validateFeatureVector}. */
export function isFeatureVector(input: unknown): input is FeatureVector {
  try {
    validateFeatureVector(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an untrusted payload against the {@link ModelResult} contract.
 *
 * Nulls are rejected everywhere: an output is complete or it does not exist.
 *
 * @throws {SchemaValidationError}
 */
export function validateModelResult(input: unknown): ModelResult {
  const issues: string[] = [];

  if (!isPlainObject(input)) {
    throw new SchemaValidationError("ModelResult", [
      "payload must be a plain object",
    ]);
  }

  const known = new Set<string>([
    "schemaVersion",
    "modelId",
    "modelVersion",
    "featureVectorVersion",
    "task",
    "subjectId",
    "scoredAt",
    "score",
    "label",
    "confidence",
    "imputedFields",
  ]);
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      issues.push(`unknown field ${JSON.stringify(key)}`);
    }
  }

  checkString(
    issues,
    input,
    "schemaVersion",
    SEMVER_PATTERN,
    "be a semver string such as \"1.0.0\"",
  );
  if (
    typeof input.schemaVersion === "string" &&
    SEMVER_PATTERN.test(input.schemaVersion) &&
    input.schemaVersion !== MODEL_RESULT_SCHEMA_VERSION
  ) {
    issues.push(
      `schemaVersion ${input.schemaVersion} is not supported by this build (expected ${MODEL_RESULT_SCHEMA_VERSION})`,
    );
  }

  checkString(
    issues,
    input,
    "modelId",
    MODEL_ID_PATTERN,
    "match [A-Za-z0-9._-]{1,128}",
  );
  checkString(
    issues,
    input,
    "modelVersion",
    SEMVER_PATTERN,
    "be a semver string such as \"2.3.1\"",
  );
  checkString(
    issues,
    input,
    "featureVectorVersion",
    SEMVER_PATTERN,
    "be a semver string such as \"1.0.0\"",
  );
  checkEnum(issues, input, "task", MODEL_TASKS);
  checkString(
    issues,
    input,
    "subjectId",
    SUBJECT_ID_PATTERN,
    "be an opaque pseudonymous id matching [A-Za-z0-9_-]{1,128} and must not carry personal data",
  );
  checkTimestamp(issues, input, "scoredAt");
  checkBoundedNumber(issues, input, "score", 0, 1);
  checkEnum(issues, input, "label", RISK_LABELS);
  checkBoundedNumber(issues, input, "confidence", 0, 1);

  const featureNames = new Set<string>(
    NUMERIC_FEATURE_SPECS.map((spec) => spec.name),
  );
  const imputed = input.imputedFields;
  if (!Array.isArray(imputed)) {
    issues.push("imputedFields must be an array (empty when nothing was imputed)");
  } else {
    for (const name of imputed) {
      if (typeof name !== "string" || !featureNames.has(name)) {
        issues.push(
          `imputedFields contains ${JSON.stringify(name)}, which is not a known feature name`,
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new SchemaValidationError("ModelResult", issues);
  }
  return input as unknown as ModelResult;
}

/** Non-throwing type guard over {@link validateModelResult}. */
export function isModelResult(input: unknown): input is ModelResult {
  try {
    validateModelResult(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply the documented missing-value policy: replace every `null` feature with
 * its `missingDefault` and record which fields were filled in.
 *
 * The input is validated first, so this is the single supported way to turn an
 * untrusted payload into something a model may consume.
 *
 * @throws {SchemaValidationError} if `input` is not a valid {@link FeatureVector}.
 */
export function imputeFeatureVector(input: unknown): ImputedFeatureVector {
  const vector = validateFeatureVector(input);
  const imputedFields: NumericFeatureName[] = [];
  // Every NumericFeatureName is assigned in the loop below, one per spec.
  const filled = {} as Record<NumericFeatureName, number>;

  for (const spec of NUMERIC_FEATURE_SPECS) {
    const value = vector[spec.name];
    if (value === null) {
      imputedFields.push(spec.name);
      filled[spec.name] = spec.missingDefault;
    } else {
      filled[spec.name] = value;
    }
  }

  return {
    schemaVersion: vector.schemaVersion,
    subjectId: vector.subjectId,
    subjectKind: vector.subjectKind,
    observedAt: vector.observedAt,
    kycTier: vector.kycTier,
    ...filled,
    imputedFields,
  };
}

// ---------------------------------------------------------------------------
// Synthetic examples
// ---------------------------------------------------------------------------
//
// Fabricated by hand for documentation and tests. `subjectId` values are
// literal placeholders, not hashes of anything real, and no field derives from
// a real account, person, or ledger entry.

/** Synthetic {@link FeatureVector} with every field populated. */
export const EXAMPLE_FEATURE_VECTOR: FeatureVector = {
  schemaVersion: FEATURE_VECTOR_SCHEMA_VERSION,
  subjectId: "synthetic-account-0001",
  subjectKind: "account",
  observedAt: "2026-01-15T00:00:00.000Z",
  kycTier: 2,
  accountAgeDays: 418,
  transactionCount30d: 37,
  averageBalanceStroops: 1_250_000_000, // 125 XLM
  largestTransferStroops: 400_000_000, // 40 XLM
  distinctCounterparties30d: 12,
  failedPaymentCount90d: 1,
  disputeRatio90d: 0.0,
  crossBorderTransferRatio30d: 0.24,
  medianSettlementLatencySeconds: 5.4,
};

/**
 * Synthetic {@link FeatureVector} exercising the missing-value convention:
 * three sources were unavailable, so those fields are explicitly `null`.
 */
export const EXAMPLE_FEATURE_VECTOR_WITH_GAPS: FeatureVector = {
  schemaVersion: FEATURE_VECTOR_SCHEMA_VERSION,
  subjectId: "synthetic-account-0002",
  subjectKind: "account",
  observedAt: "2026-01-15T00:00:00.000Z",
  kycTier: 0,
  accountAgeDays: null,
  transactionCount30d: 2,
  averageBalanceStroops: null,
  largestTransferStroops: 90_000_000, // 9 XLM
  distinctCounterparties30d: 2,
  failedPaymentCount90d: 0,
  disputeRatio90d: 0.0,
  crossBorderTransferRatio30d: 1.0,
  medianSettlementLatencySeconds: null,
};

/** Synthetic {@link ModelResult} corresponding to {@link EXAMPLE_FEATURE_VECTOR}. */
export const EXAMPLE_MODEL_RESULT: ModelResult = {
  schemaVersion: MODEL_RESULT_SCHEMA_VERSION,
  modelId: "credit-score-gbm",
  modelVersion: "2.3.1",
  featureVectorVersion: FEATURE_VECTOR_SCHEMA_VERSION,
  task: "credit-score",
  subjectId: "synthetic-account-0001",
  scoredAt: "2026-01-15T00:00:03.412Z",
  score: 0.17,
  label: "low",
  confidence: 0.91,
  imputedFields: [],
};

/**
 * Synthetic {@link ModelResult} corresponding to
 * {@link EXAMPLE_FEATURE_VECTOR_WITH_GAPS}: the same three fields that were
 * `null` on the way in are reported back on the way out.
 */
export const EXAMPLE_MODEL_RESULT_WITH_IMPUTATION: ModelResult = {
  schemaVersion: MODEL_RESULT_SCHEMA_VERSION,
  modelId: "fraud-detect-iforest",
  modelVersion: "0.9.0",
  featureVectorVersion: FEATURE_VECTOR_SCHEMA_VERSION,
  task: "fraud-detect",
  subjectId: "synthetic-account-0002",
  scoredAt: "2026-01-15T00:00:03.907Z",
  score: 0.78,
  label: "high",
  confidence: 0.62,
  imputedFields: [
    "accountAgeDays",
    "averageBalanceStroops",
    "medianSettlementLatencySeconds",
  ],
};
