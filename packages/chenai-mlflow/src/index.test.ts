import { describe, expect, it } from "vitest";

import {
  EXAMPLE_FEATURE_VECTOR,
  EXAMPLE_FEATURE_VECTOR_WITH_GAPS,
  EXAMPLE_MODEL_RESULT,
  EXAMPLE_MODEL_RESULT_WITH_IMPUTATION,
  FEATURE_VECTOR_SCHEMA_VERSION,
  MODEL_RESULT_SCHEMA_VERSION,
  NUMERIC_FEATURE_SPECS,
  SchemaValidationError,
  imputeFeatureVector,
  isFeatureVector,
  isModelResult,
  validateFeatureVector,
  validateModelResult,
} from "./index.js";

/** Clone the good example and override one field, to isolate a single rule. */
function featureVectorWith(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return { ...EXAMPLE_FEATURE_VECTOR, ...overrides };
}

function modelResultWith(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return { ...EXAMPLE_MODEL_RESULT, ...overrides };
}

describe("documented examples", () => {
  it("accepts the fully populated feature vector example", () => {
    expect(validateFeatureVector(EXAMPLE_FEATURE_VECTOR)).toEqual(
      EXAMPLE_FEATURE_VECTOR,
    );
    expect(isFeatureVector(EXAMPLE_FEATURE_VECTOR)).toBe(true);
  });

  it("accepts the feature vector example that carries explicit nulls", () => {
    expect(isFeatureVector(EXAMPLE_FEATURE_VECTOR_WITH_GAPS)).toBe(true);
  });

  it("accepts both model result examples", () => {
    expect(validateModelResult(EXAMPLE_MODEL_RESULT)).toEqual(
      EXAMPLE_MODEL_RESULT,
    );
    expect(isModelResult(EXAMPLE_MODEL_RESULT_WITH_IMPUTATION)).toBe(true);
  });

  it("survives a JSON round trip, since the wire format is JSON", () => {
    const roundTripped: unknown = JSON.parse(
      JSON.stringify(EXAMPLE_FEATURE_VECTOR_WITH_GAPS),
    );
    expect(isFeatureVector(roundTripped)).toBe(true);
  });

  it("uses only obviously synthetic subject ids", () => {
    for (const example of [
      EXAMPLE_FEATURE_VECTOR,
      EXAMPLE_FEATURE_VECTOR_WITH_GAPS,
      EXAMPLE_MODEL_RESULT,
      EXAMPLE_MODEL_RESULT_WITH_IMPUTATION,
    ]) {
      expect(example.subjectId).toMatch(/^synthetic-/);
    }
  });

  it("pins the examples to the schema versions this build implements", () => {
    expect(EXAMPLE_FEATURE_VECTOR.schemaVersion).toBe(
      FEATURE_VECTOR_SCHEMA_VERSION,
    );
    expect(EXAMPLE_MODEL_RESULT.schemaVersion).toBe(
      MODEL_RESULT_SCHEMA_VERSION,
    );
    expect(EXAMPLE_MODEL_RESULT.featureVectorVersion).toBe(
      FEATURE_VECTOR_SCHEMA_VERSION,
    );
  });
});

describe("validateFeatureVector — structural rules", () => {
  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "{}"],
    ["a number", 7],
  ])("rejects %s as a payload", (_label, payload) => {
    expect(() => validateFeatureVector(payload)).toThrow(SchemaValidationError);
  });

  it("rejects an absent field rather than treating it as missing data", () => {
    const { accountAgeDays: _omitted, ...withoutField } =
      EXAMPLE_FEATURE_VECTOR;
    expect(() => validateFeatureVector(withoutField)).toThrow(
      /accountAgeDays is required; use an explicit null/,
    );
  });

  it("rejects undefined in place of an explicit null", () => {
    expect(() =>
      validateFeatureVector(featureVectorWith({ accountAgeDays: undefined })),
    ).toThrow(/must not be undefined/);
  });

  it("rejects unknown fields", () => {
    expect(() =>
      validateFeatureVector(featureVectorWith({ shoeSize: 42 })),
    ).toThrow(/unknown field "shoeSize"/);
  });

  it("reports every violation at once, not just the first", () => {
    let caught: SchemaValidationError | undefined;
    try {
      validateFeatureVector(
        featureVectorWith({
          subjectId: "",
          kycTier: 9,
          disputeRatio90d: 4,
        }),
      );
    } catch (error) {
      caught = error as SchemaValidationError;
    }
    expect(caught).toBeInstanceOf(SchemaValidationError);
    expect(caught?.schema).toBe("FeatureVector");
    expect(caught?.issues).toHaveLength(3);
  });
});

describe("validateFeatureVector — field rules", () => {
  it("rejects a schemaVersion this build does not implement", () => {
    expect(() =>
      validateFeatureVector(featureVectorWith({ schemaVersion: "2.0.0" })),
    ).toThrow(/is not supported by this build/);
  });

  it("rejects a subjectId that looks like personal data", () => {
    expect(() =>
      validateFeatureVector(
        featureVectorWith({ subjectId: "ada.lovelace@example.com" }),
      ),
    ).toThrow(/must not carry personal data/);
  });

  it("rejects a non-UTC or malformed observedAt", () => {
    for (const bad of [
      "2026-01-15T00:00:00+01:00",
      "2026-01-15",
      "15/01/2026",
      "2026-13-40T00:00:00.000Z",
    ]) {
      expect(() =>
        validateFeatureVector(featureVectorWith({ observedAt: bad })),
      ).toThrow(SchemaValidationError);
    }
  });

  it("requires kycTier and rejects null for it", () => {
    expect(() =>
      validateFeatureVector(featureVectorWith({ kycTier: null })),
    ).toThrow(/kycTier must be one of/);
  });

  it("rejects NaN and Infinity in numeric features", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        validateFeatureVector(featureVectorWith({ transactionCount30d: bad })),
      ).toThrow(/must be a finite number or null/);
    }
  });

  it("rejects a fractional value in an integer field", () => {
    expect(() =>
      validateFeatureVector(featureVectorWith({ transactionCount30d: 3.5 })),
    ).toThrow(/must be an integer/);
  });

  it("allows a fractional value in a non-integer field", () => {
    expect(
      isFeatureVector(featureVectorWith({ disputeRatio90d: 0.125 })),
    ).toBe(true);
  });

  it("rejects a ratio outside [0, 1]", () => {
    expect(() =>
      validateFeatureVector(featureVectorWith({ disputeRatio90d: 1.5 })),
    ).toThrow(/must be within \[0, 1\]/);
  });

  it("rejects negative counts and amounts", () => {
    expect(() =>
      validateFeatureVector(
        featureVectorWith({ averageBalanceStroops: -1 }),
      ),
    ).toThrow(/must be within/);
  });

  it("rejects a numeric feature supplied as a numeric string", () => {
    expect(() =>
      validateFeatureVector(featureVectorWith({ accountAgeDays: "418" })),
    ).toThrow(/must be a finite number or null/);
  });

  it("accepts every numeric feature at both of its documented bounds", () => {
    for (const spec of NUMERIC_FEATURE_SPECS) {
      for (const bound of [spec.min, spec.max]) {
        expect(isFeatureVector(featureVectorWith({ [spec.name]: bound }))).toBe(
          true,
        );
      }
    }
  });

  it("accepts null for every numeric feature", () => {
    for (const spec of NUMERIC_FEATURE_SPECS) {
      expect(isFeatureVector(featureVectorWith({ [spec.name]: null }))).toBe(
        true,
      );
    }
  });
});

describe("imputeFeatureVector", () => {
  it("leaves a complete vector untouched and reports nothing imputed", () => {
    const imputed = imputeFeatureVector(EXAMPLE_FEATURE_VECTOR);
    expect(imputed.imputedFields).toEqual([]);
    expect(imputed.accountAgeDays).toBe(EXAMPLE_FEATURE_VECTOR.accountAgeDays);
    expect(imputed.subjectId).toBe(EXAMPLE_FEATURE_VECTOR.subjectId);
  });

  it("fills nulls with the documented defaults and names the filled fields", () => {
    const imputed = imputeFeatureVector(EXAMPLE_FEATURE_VECTOR_WITH_GAPS);
    expect(imputed.imputedFields).toEqual([
      "accountAgeDays",
      "averageBalanceStroops",
      "medianSettlementLatencySeconds",
    ]);
    expect(imputed.accountAgeDays).toBe(0);
    expect(imputed.averageBalanceStroops).toBe(0);
    // Unknown latency imputes to one day, deliberately not to zero.
    expect(imputed.medianSettlementLatencySeconds).toBe(86_400);
  });

  it("matches the imputedFields reported by the paired model result example", () => {
    const imputed = imputeFeatureVector(EXAMPLE_FEATURE_VECTOR_WITH_GAPS);
    expect(imputed.imputedFields).toEqual(
      EXAMPLE_MODEL_RESULT_WITH_IMPUTATION.imputedFields,
    );
  });

  it("yields a number for every numeric feature", () => {
    const imputed = imputeFeatureVector(EXAMPLE_FEATURE_VECTOR_WITH_GAPS);
    for (const spec of NUMERIC_FEATURE_SPECS) {
      expect(typeof imputed[spec.name]).toBe("number");
    }
  });

  it("validates before imputing, so invalid input never reaches a model", () => {
    expect(() =>
      imputeFeatureVector(featureVectorWith({ disputeRatio90d: 42 })),
    ).toThrow(SchemaValidationError);
  });
});

describe("validateModelResult", () => {
  it("rejects null anywhere — a result is complete or it does not exist", () => {
    for (const field of ["score", "label", "confidence", "modelVersion"]) {
      expect(() => validateModelResult(modelResultWith({ [field]: null }))).toThrow(
        SchemaValidationError,
      );
    }
  });

  it("rejects a score or confidence outside [0, 1]", () => {
    expect(() => validateModelResult(modelResultWith({ score: 1.01 }))).toThrow(
      /score must be within \[0, 1\]/,
    );
    expect(() =>
      validateModelResult(modelResultWith({ confidence: -0.1 })),
    ).toThrow(/confidence must be within \[0, 1\]/);
  });

  it("rejects an unknown task or label", () => {
    expect(() =>
      validateModelResult(modelResultWith({ task: "sentiment" })),
    ).toThrow(/task must be one of/);
    expect(() =>
      validateModelResult(modelResultWith({ label: "catastrophic" })),
    ).toThrow(/label must be one of/);
  });

  it("rejects a non-semver modelVersion", () => {
    expect(() =>
      validateModelResult(modelResultWith({ modelVersion: "latest" })),
    ).toThrow(/modelVersion must be a semver string/);
  });

  it("rejects imputedFields naming something that is not a feature", () => {
    expect(() =>
      validateModelResult(modelResultWith({ imputedFields: ["shoeSize"] })),
    ).toThrow(/not a known feature name/);
  });

  it("requires imputedFields to be present as an empty array, not omitted", () => {
    const { imputedFields: _omitted, ...withoutField } = EXAMPLE_MODEL_RESULT;
    expect(() => validateModelResult(withoutField)).toThrow(
      /imputedFields must be an array/,
    );
  });

  it("rejects unknown fields", () => {
    expect(() =>
      validateModelResult(modelResultWith({ explanation: "because" })),
    ).toThrow(/unknown field "explanation"/);
  });
});
