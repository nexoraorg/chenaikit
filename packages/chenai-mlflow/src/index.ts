// @chenaikit/chenai-mlflow — ML experiment tracking integration
export const VERSION = "0.1.0";

/**
 * Version of the model artifact provenance format emitted and understood by
 * this package.
 *
 * The format version is embedded in every {@link ProvenanceMetadata} record so
 * that consumers (the backend, the ML pipeline in `ml/`, and the Soroban
 * `model-attestation` contract) can tell whether they are able to interpret a
 * payload before trusting it. Bump this constant whenever the meaning or the
 * set of required fields changes; add the old version to
 * {@link SUPPORTED_PROVENANCE_FORMAT_VERSIONS} only if it stays readable.
 */
export const PROVENANCE_FORMAT_VERSION = 1;

/**
 * Every format version this package can parse. `parseProvenance` rejects any
 * payload whose `formatVersion` is not listed here rather than guessing.
 */
export const SUPPORTED_PROVENANCE_FORMAT_VERSIONS: readonly number[] = [
  PROVENANCE_FORMAT_VERSION,
];

/** A single resolved dependency that contributed to building an artifact. */
export interface Dependency {
  /** Package name as resolved by the build, e.g. `"scikit-learn"`. */
  name: string;
  /** Exact resolved version, e.g. `"1.5.1"`. Ranges are not provenance. */
  version: string;
}

/**
 * Provenance attached to a model artifact: enough information to reproduce how
 * the artifact was built, and to attest to it on-chain.
 *
 * Format version 1 requires all six fields below. Producers must never publish
 * an artifact with partial provenance — use {@link createProvenance} (or
 * {@link validateProvenance} followed by {@link serializeProvenance}) so that
 * incomplete records are rejected instead of silently accepted.
 */
export interface ProvenanceMetadata {
  /** Provenance format version. Always {@link PROVENANCE_FORMAT_VERSION} for newly created records. */
  formatVersion: number;
  /** Source revision the artifact was built from — a full git commit SHA. */
  sourceRevision: string;
  /** URL of the repository holding that revision. */
  sourceRepository: string;
  /**
   * Ordered list of dependencies present at build time. Order is significant
   * (it mirrors the resolver's output) and is preserved across serialization.
   */
  dependencies: Dependency[];
  /**
   * Identifier or hash of the training/build configuration used, e.g. the
   * digest of the resolved config file.
   */
  configurationId: string;
  /** Creation timestamp of the artifact, ISO 8601 with an explicit offset. */
  createdAt: string;
}

/**
 * Required fields of provenance format version 1, in canonical order. Kept in
 * sync with `PROVENANCE_FIELDS` in `contracts/model-attestation/src/lib.rs`.
 */
export const REQUIRED_PROVENANCE_FIELDS = [
  "formatVersion",
  "sourceRevision",
  "sourceRepository",
  "dependencies",
  "configurationId",
  "createdAt",
] as const;

export type RequiredProvenanceField = (typeof REQUIRED_PROVENANCE_FIELDS)[number];

/**
 * Result of checking a candidate provenance record.
 *
 * - `missingFields` — required fields that are absent, `null`/`undefined`, or
 *   blank. These are the fields a producer still has to supply.
 * - `invalidFields` — required fields that are present but malformed (wrong
 *   type, unsupported format version, non-ISO timestamp, dependency entry
 *   without a name or version).
 *
 * `valid` is true only when both lists are empty.
 */
export interface ProvenanceValidationResult {
  valid: boolean;
  missingFields: string[];
  invalidFields: string[];
}

/** Input accepted by {@link createProvenance}; `formatVersion` defaults to the current one. */
export type ProvenanceInput = Omit<ProvenanceMetadata, "formatVersion"> & {
  formatVersion?: number;
};

/** Outcome of {@link createProvenance}: either a complete record, or the reasons it was refused. */
export type CreateProvenanceResult =
  | { ok: true; provenance: ProvenanceMetadata }
  | {
      ok: false;
      error: string;
      missingFields: string[];
      invalidFields: string[];
    };

/** Outcome of {@link parseProvenance}. Never returns a partially understood record. */
export type ParseProvenanceResult =
  | { ok: true; provenance: ProvenanceMetadata }
  | {
      ok: false;
      /**
       * - `malformed-json` — the payload is not valid JSON, or not a JSON object.
       * - `unsupported-format-version` — `formatVersion` is missing or not one
       *   this package understands; the record is refused, not guessed at.
       * - `incomplete-provenance` — the version is understood but required
       *   fields are missing or malformed.
       */
      reason:
        | "malformed-json"
        | "unsupported-format-version"
        | "incomplete-provenance";
      error: string;
      missingFields: string[];
      invalidFields: string[];
    };

/** Thrown by {@link serializeProvenance} when asked to publish incomplete provenance. */
export class ProvenanceValidationError extends Error {
  readonly missingFields: string[];
  readonly invalidFields: string[];

  constructor(missingFields: string[], invalidFields: string[]) {
    super(describeInvalidProvenance(missingFields, invalidFields));
    this.name = "ProvenanceValidationError";
    this.missingFields = missingFields;
    this.invalidFields = invalidFields;
  }
}

/** True when this package understands records stamped with `formatVersion`. */
export function isSupportedProvenanceFormatVersion(
  formatVersion: unknown
): formatVersion is number {
  return (
    typeof formatVersion === "number" &&
    SUPPORTED_PROVENANCE_FORMAT_VERSIONS.includes(formatVersion)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIso8601(value: string): boolean {
  // Date, time, and an explicit UTC marker or numeric offset.
  const pattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  return pattern.test(value) && !Number.isNaN(Date.parse(value));
}

function isDependency(value: unknown): value is Dependency {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Dependency>;
  return isNonEmptyString(candidate.name) && isNonEmptyString(candidate.version);
}

function describeInvalidProvenance(
  missingFields: string[],
  invalidFields: string[]
): string {
  const parts: string[] = [];
  if (missingFields.length > 0) {
    parts.push(`missing fields: ${missingFields.join(", ")}`);
  }
  if (invalidFields.length > 0) {
    parts.push(`invalid fields: ${invalidFields.join(", ")}`);
  }
  return `Incomplete model artifact provenance (${
    parts.join("; ") || "unknown reason"
  }).`;
}

/**
 * Check a candidate provenance record against format version 1.
 *
 * Absent or blank required fields are reported in `missingFields`; present but
 * malformed ones in `invalidFields`. Nothing is defaulted or repaired here —
 * the caller decides what to do with an incomplete record.
 */
export function validateProvenance(
  input: Partial<ProvenanceMetadata> | null | undefined
): ProvenanceValidationResult {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  if (typeof input !== "object" || input === null) {
    return {
      valid: false,
      missingFields: [...REQUIRED_PROVENANCE_FIELDS],
      invalidFields: [],
    };
  }

  const record = input as Record<string, unknown>;

  for (const field of REQUIRED_PROVENANCE_FIELDS) {
    const value = record[field];

    if (value === undefined || value === null) {
      missingFields.push(field);
      continue;
    }

    switch (field) {
      case "formatVersion":
        if (!isSupportedProvenanceFormatVersion(value)) invalidFields.push(field);
        break;
      case "dependencies":
        if (!Array.isArray(value) || !value.every(isDependency)) {
          invalidFields.push(field);
        }
        break;
      case "createdAt":
        if (typeof value !== "string") invalidFields.push(field);
        else if (value.trim().length === 0) missingFields.push(field);
        else if (!isIso8601(value)) invalidFields.push(field);
        break;
      default:
        // Remaining required fields are plain non-empty strings.
        if (typeof value !== "string") invalidFields.push(field);
        else if (value.trim().length === 0) missingFields.push(field);
        break;
    }
  }

  return {
    valid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
  };
}

/**
 * Build a {@link ProvenanceMetadata} record from complete input.
 *
 * `formatVersion` defaults to {@link PROVENANCE_FORMAT_VERSION}. Incomplete or
 * malformed input never produces a record: the result is tagged `ok: false` and
 * carries the exact field names that need fixing.
 */
export function createProvenance(
  input: Partial<ProvenanceInput> | null | undefined
): CreateProvenanceResult {
  const candidate: Partial<ProvenanceMetadata> = {
    ...(input ?? {}),
    formatVersion: input?.formatVersion ?? PROVENANCE_FORMAT_VERSION,
  };

  const { valid, missingFields, invalidFields } = validateProvenance(candidate);
  if (!valid) {
    return {
      ok: false,
      error: describeInvalidProvenance(missingFields, invalidFields),
      missingFields,
      invalidFields,
    };
  }

  const complete = candidate as ProvenanceMetadata;
  return {
    ok: true,
    provenance: {
      formatVersion: complete.formatVersion,
      sourceRevision: complete.sourceRevision,
      sourceRepository: complete.sourceRepository,
      // Copy defensively; dependency order is part of the provenance.
      dependencies: complete.dependencies.map((dependency) => ({
        name: dependency.name,
        version: dependency.version,
      })),
      configurationId: complete.configurationId,
      createdAt: complete.createdAt,
    },
  };
}

/**
 * Serialize provenance to the JSON payload that accompanies a published
 * artifact.
 *
 * This is the last gate before publishing: incomplete provenance throws a
 * {@link ProvenanceValidationError} listing the offending fields rather than
 * emitting a half-populated payload.
 */
export function serializeProvenance(provenance: ProvenanceMetadata): string {
  const { valid, missingFields, invalidFields } = validateProvenance(provenance);
  if (!valid) {
    throw new ProvenanceValidationError(missingFields, invalidFields);
  }

  // Canonical key order matches REQUIRED_PROVENANCE_FIELDS so payloads hash
  // reproducibly.
  return JSON.stringify({
    formatVersion: provenance.formatVersion,
    sourceRevision: provenance.sourceRevision,
    sourceRepository: provenance.sourceRepository,
    dependencies: provenance.dependencies.map((dependency) => ({
      name: dependency.name,
      version: dependency.version,
    })),
    configurationId: provenance.configurationId,
    createdAt: provenance.createdAt,
  });
}

/**
 * Parse a serialized provenance payload.
 *
 * Compatibility is checked before anything else: a payload with a
 * `formatVersion` this package does not know is refused with
 * `reason: "unsupported-format-version"` instead of being read on a best-effort
 * basis. Recognized-but-incomplete payloads are refused too, with the missing
 * and invalid field names attached.
 */
export function parseProvenance(payload: string): ParseProvenanceResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch (cause) {
    return {
      ok: false,
      reason: "malformed-json",
      error: `Provenance payload is not valid JSON: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      missingFields: [],
      invalidFields: [],
    };
  }

  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return {
      ok: false,
      reason: "malformed-json",
      error: "Provenance payload must be a JSON object.",
      missingFields: [],
      invalidFields: [],
    };
  }

  const record = decoded as Record<string, unknown>;
  if (!isSupportedProvenanceFormatVersion(record.formatVersion)) {
    return {
      ok: false,
      reason: "unsupported-format-version",
      error: `Unsupported provenance formatVersion ${JSON.stringify(
        record.formatVersion ?? null
      )}; this build understands ${SUPPORTED_PROVENANCE_FORMAT_VERSIONS.join(
        ", "
      )}.`,
      missingFields: record.formatVersion === undefined ? ["formatVersion"] : [],
      invalidFields: record.formatVersion === undefined ? [] : ["formatVersion"],
    };
  }

  const created = createProvenance(record as Partial<ProvenanceInput>);
  if (!created.ok) {
    return {
      ok: false,
      reason: "incomplete-provenance",
      error: created.error,
      missingFields: created.missingFields,
      invalidFields: created.invalidFields,
    };
  }

  return { ok: true, provenance: created.provenance };
}
