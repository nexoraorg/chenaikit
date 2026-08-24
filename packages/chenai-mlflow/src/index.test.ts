import { describe, expect, it } from "vitest";
import {
  EVALUATION_REPORT_SCHEMA_VERSION,
  EvaluationReportError,
  MissingMetadataError,
  ReportIntegrityError,
  SensitiveDataError,
  canonicalJson,
  computeReportDigest,
  createEvaluationReport,
  parseEvaluationReport,
  serializeEvaluationReport,
  validateEvaluationReport,
  type CreateEvaluationReportInput,
} from "./index.js";

const FIXED_TIME = "2026-01-15T10:00:00Z";

const baseInput: CreateEvaluationReportInput = {
  model: { name: "credit-score", version: "1.2.0" },
  dataset: { identifier: "chena-loans-2024", version: "3" },
  evaluation: {
    config_id: "eval-2024-06-config",
    params: { threshold: 0.5, cv_folds: 5, shuffle: true },
  },
  metrics: { accuracy: 0.91, f1: 0.89, notes: null },
  generated_at: FIXED_TIME,
  code_version: "abc1234",
};

const build = (overrides: Partial<CreateEvaluationReportInput> = {}) =>
  createEvaluationReport({ ...baseInput, ...overrides });

describe("deterministic serialization", () => {
  it("produces identical bytes for identical inputs", () => {
    const first = serializeEvaluationReport(build());
    const second = serializeEvaluationReport(build());
    expect(first).toBe(second);
    expect(build().report_id).toBe(build().report_id);
  });

  it("is canonical JSON with sorted keys and no whitespace", () => {
    const serialized = serializeEvaluationReport(build());
    expect(serialized).toBe(canonicalJson(JSON.parse(serialized)));
    expect(serialized).not.toContain(": ");
    expect(serialized).toContain(
      `"schema_version":"${EVALUATION_REPORT_SCHEMA_VERSION}"`,
    );
  });

  it("does not depend on input key insertion order", () => {
    const reordered = build({
      model: { version: "1.2.0", name: "credit-score" },
      dataset: { version: "3", identifier: "chena-loans-2024" },
      evaluation: {
        params: { shuffle: true, cv_folds: 5, threshold: 0.5 },
        config_id: "eval-2024-06-config",
      },
      metrics: { notes: null, f1: 0.89, accuracy: 0.91 },
    });
    expect(serializeEvaluationReport(reordered)).toBe(
      serializeEvaluationReport(build()),
    );
  });
});

describe("required metadata", () => {
  it("identifies model, data, and evaluation configuration", () => {
    const report = build();
    expect(report.model).toEqual({ name: "credit-score", version: "1.2.0" });
    expect(report.dataset.identifier).toBe("chena-loans-2024");
    expect(report.evaluation.config_id).toBe("eval-2024-06-config");
    expect(report.schema_version).toBe(EVALUATION_REPORT_SCHEMA_VERSION);
    expect(report.report_id).toMatch(/^er-/);
  });

  it("fails when the model name is missing", () => {
    expect(() =>
      build({ model: { name: "", version: "1" } }),
    ).toThrow(MissingMetadataError);
  });

  it("fails when the dataset identifier is missing", () => {
    const input = { ...baseInput, dataset: { version: "3" } } as CreateEvaluationReportInput;
    expect(() => createEvaluationReport(input)).toThrow(MissingMetadataError);
  });

  it("fails when the evaluation config id is missing", () => {
    const input = {
      ...baseInput,
      evaluation: { params: {} },
    } as unknown as CreateEvaluationReportInput;
    expect(() => createEvaluationReport(input)).toThrow(/config_id/);
    expect(() => createEvaluationReport(input)).toThrow(MissingMetadataError);
  });
});

describe("sensitive data guard", () => {
  it("rejects container metric values", () => {
    expect(() =>
      build({ metrics: { training_records: [1, 2, 3] } as never }),
    ).toThrow(SensitiveDataError);
  });

  it("rejects raw-data keys", () => {
    expect(() => build({ metrics: { raw_data: "nope" } })).toThrow(
      SensitiveDataError,
    );
    for (const key of ["records", "rows", "samples", "data"]) {
      expect(() =>
        build({ metrics: { [key]: 1 } }),
      ).toThrow(SensitiveDataError);
    }
  });

  it("allows aggregate counts like n_samples", () => {
    expect(() => build({ metrics: { n_samples: 1000 } })).not.toThrow();
  });

  it("rejects oversized strings and non-finite numbers", () => {
    expect(() => build({ metrics: { dump: "x".repeat(600) } })).toThrow(
      SensitiveDataError,
    );
    expect(() => build({ metrics: { score: Number.NaN } })).toThrow(
      EvaluationReportError,
    );
  });
});

describe("parsing and integrity", () => {
  it("round-trips a serialized report", () => {
    const report = build();
    expect(parseEvaluationReport(serializeEvaluationReport(report))).toEqual(
      report,
    );
  });

  it("detects tampering via content digest", () => {
    const report = build();
    const tampered = { ...report, metrics: { ...report.metrics, f1: 0.99 } };
    expect(computeReportDigest(report)).not.toBe(computeReportDigest(tampered));
    expect(() => validateEvaluationReport(tampered)).toThrow(
      ReportIntegrityError,
    );
  });

  it("rejects unsupported schema versions", () => {
    const report = build() as unknown as Record<string, unknown>;
    expect(() =>
      validateEvaluationReport({ ...report, schema_version: "999" }),
    ).toThrow(ReportIntegrityError);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseEvaluationReport("{oops")).toThrow(ReportIntegrityError);
  });
});
