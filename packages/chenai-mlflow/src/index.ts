// @chenaikit/chenai-mlflow — ML experiment tracking integration.
//
// Exposes the evaluation report schema produced by `ml/evaluation_report.py`
// so TS consumers can create, serialize, and validate the same artifacts.
// Property names mirror the persisted (snake_case) wire format on purpose:
// reports written by the Python pipeline must be readable here and vice versa.

import { createHash } from "node:crypto";

export const VERSION = "0.1.0";
export const EVALUATION_REPORT_SCHEMA_VERSION = "1.0";

export type ReportScalar = string | number | boolean | null;

export interface EvaluationReportModel {
  name: string;
  version: string;
}

export interface EvaluationReportDataset {
  identifier: string;
  version: string;
}

export interface EvaluationReportEvaluation {
  config_id: string;
  params?: Record<string, ReportScalar>;
}

export interface EvaluationReport {
  schema_version: string;
  report_id: string;
  generated_at: string;
  model: EvaluationReportModel;
  dataset: EvaluationReportDataset;
  evaluation: EvaluationReportEvaluation;
  metrics: Record<string, ReportScalar>;
  code_version?: string;
}

export interface CreateEvaluationReportInput {
  model: EvaluationReportModel;
  dataset: EvaluationReportDataset;
  evaluation: EvaluationReportEvaluation;
  metrics: Record<string, ReportScalar>;
  /** Explicit ISO-8601 timestamp; defaults to current UTC time. */
  generated_at?: string;
  code_version?: string;
}

export class EvaluationReportError extends Error {}

export class MissingMetadataError extends EvaluationReportError {}

export class SensitiveDataError extends EvaluationReportError {}

export class ReportIntegrityError extends EvaluationReportError {}

// Keys are matched case-insensitively; exact matches keep aggregate stats
// such as `n_samples` usable while still blocking raw-data dumps.
const SENSITIVE_KEY_EXACT = new Set([
  "records",
  "rows",
  "samples",
  "raw",
  "data",
  "training_set",
  "test_set",
]);
const SENSITIVE_KEY_SUBSTRINGS = [
  "raw_data",
  "training_data",
  "train_data",
  "data_records",
  "serialized_data",
];

const MAX_STRING_LENGTH = 512;

function checkKey(path: string, key: string): void {
  const lowered = key.toLowerCase();
  if (
    SENSITIVE_KEY_EXACT.has(lowered) ||
    SENSITIVE_KEY_SUBSTRINGS.some((p) => lowered.includes(p))
  ) {
    throw new SensitiveDataError(
      `${path}: refusing to store value under sensitive-looking key "${key}"`,
    );
  }
}

function checkScalar(path: string, value: unknown): asserts value is ReportScalar {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new EvaluationReportError(
        `${path}: NaN/Infinity cannot be serialized to JSON`,
      );
    }
    return;
  }
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      throw new SensitiveDataError(
        `${path}: string values are capped at ${MAX_STRING_LENGTH} characters; bulk payloads do not belong in reports`,
      );
    }
    return;
  }
  throw new SensitiveDataError(
    `${path}: expected a scalar (string/number/boolean/null), got ${typeof value}; containers may carry training data`,
  );
}

function checkScalars(section: string, mapping: unknown): void {
  if (mapping === undefined || mapping === null) return;
  if (typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new ReportIntegrityError(`${section} must be an object`);
  }
  for (const [key, value] of Object.entries(mapping)) {
    checkKey(`${section}.${key}`, key);
    checkScalar(`${section}.${key}`, value);
  }
}

function requireFields(
  section: string,
  metadata: unknown,
  fields: readonly string[],
): void {
  if (!isRecord(metadata)) {
    throw new ReportIntegrityError(`Missing "${section}" section`);
  }
  const missing = fields.filter((f) => !String(metadata[f] ?? "").trim());
  if (missing.length > 0) {
    throw new MissingMetadataError(
      `Missing required ${section} metadata field(s): ${missing.join(", ")}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deterministic canonical JSON: recursively sorted keys, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(",")}}`;
}

function contentView(report: EvaluationReport): Record<string, unknown> {
  const { report_id: _reportId, ...rest } = report;
  return rest;
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** SHA-256 hex digest of the canonical report body (excluding report_id). */
export function computeReportDigest(report: EvaluationReport): string {
  return sha256(canonicalJson(JSON.parse(canonicalJson(contentView(report)))));
}

export function createEvaluationReport(
  input: CreateEvaluationReportInput,
): EvaluationReport {
  requireFields("model", input.model, ["name", "version"]);
  requireFields("dataset", input.dataset, ["identifier", "version"]);
  requireFields("evaluation", input.evaluation, ["config_id"]);

  checkScalars("metrics", input.metrics);
  checkScalars("evaluation.params", input.evaluation.params);

  const generatedAt =
    input.generated_at ??
    new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const report: EvaluationReport = {
    schema_version: EVALUATION_REPORT_SCHEMA_VERSION,
    report_id: "",
    generated_at: generatedAt,
    model: { name: String(input.model.name), version: String(input.model.version) },
    dataset: {
      identifier: String(input.dataset.identifier),
      version: String(input.dataset.version),
    },
    evaluation: {
      config_id: String(input.evaluation.config_id),
      params: { ...(input.evaluation.params ?? {}) },
    },
    metrics: { ...input.metrics },
  };
  if (input.code_version !== undefined) {
    report.code_version = String(input.code_version);
  }

  report.report_id = `er-${computeReportDigest(report).slice(0, 16)}`;
  validateEvaluationReport(report);
  return report;
}

export function validateEvaluationReport(
  report: unknown,
): asserts report is EvaluationReport {
  if (!isRecord(report)) {
    throw new ReportIntegrityError("Report must be a JSON object");
  }
  if (report.schema_version !== EVALUATION_REPORT_SCHEMA_VERSION) {
    throw new ReportIntegrityError(
      `Unsupported schema_version ${JSON.stringify(report.schema_version)}, expected ${JSON.stringify(EVALUATION_REPORT_SCHEMA_VERSION)}`,
    );
  }
  for (const [section, fields] of [
    ["model", ["name", "version"]],
    ["dataset", ["identifier", "version"]],
    ["evaluation", ["config_id"]],
  ] as const) {
    const block = report[section];
    if (!isRecord(block)) {
      throw new ReportIntegrityError(`Missing "${section}" section`);
    }
    requireFields(section, block, fields);
  }

  checkScalars("metrics", report.metrics);
  const evaluation = report.evaluation as Record<string, unknown>;
  checkScalars("evaluation.params", evaluation.params);

  const reportId = report.report_id;
  if (typeof reportId !== "string" || !reportId.startsWith("er-")) {
    throw new ReportIntegrityError("Missing or malformed report_id");
  }
  const expected = `er-${computeReportDigest(report as unknown as EvaluationReport).slice(0, 16)}`;
  if (reportId !== expected) {
    throw new ReportIntegrityError(
      `report_id "${reportId}" does not match report contents (expected "${expected}"); the report was modified after creation`,
    );
  }
}

/** Canonical, deterministic JSON serialization of a report. */
export function serializeEvaluationReport(report: EvaluationReport): string {
  return canonicalJson(report);
}

/** Parse and fully validate a serialized report (schema + integrity). */
export function parseEvaluationReport(json: string): EvaluationReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new ReportIntegrityError(`Invalid JSON report: ${String(error)}`);
  }
  validateEvaluationReport(parsed);
  return parsed;
}
