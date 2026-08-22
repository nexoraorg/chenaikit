# ml

Python ML pipeline. Scope unchanged from the pre-migration `ml/` — re-audit
contents during the restructure but no relocation planned.

## Model Artifact Provenance

Every model artifact this pipeline publishes must carry provenance metadata:
enough information to reproduce how the artifact was built, and to attest to it
on-chain. The format is defined and enforced by
[`@chenaikit/chenai-mlflow`](../packages/chenai-mlflow/src/index.ts).

### What is captured

Provenance is a versioned record. **Format version 1** requires all six fields
below — there are no optional fields:

| Field              | Type                          | What it records                                                        |
|--------------------|-------------------------------|------------------------------------------------------------------------|
| `formatVersion`    | integer                       | Provenance format version. `1` for records produced today.              |
| `sourceRevision`   | string                        | Git commit SHA the artifact was built from.                             |
| `sourceRepository` | string                        | URL of the repository holding that revision.                            |
| `dependencies`     | ordered `{ name, version }[]` | Dependencies resolved at build time, with exact versions — not ranges. Order is significant and is preserved through serialization. |
| `configurationId`  | string                        | Identifier or hash of the training/build configuration (e.g. the digest of the resolved config file). |
| `createdAt`        | ISO 8601 string               | Artifact creation timestamp, with an explicit UTC marker or numeric offset. |

An artifact built with no third-party dependencies still records
`dependencies: []` — the field itself is never omitted.

### Producing and validating provenance

```ts
import {
  createProvenance,
  serializeProvenance,
  parseProvenance,
  validateProvenance,
} from "@chenaikit/chenai-mlflow";

const result = createProvenance({
  sourceRevision: "9f2c1b0a7d4e5f6a8b9c0d1e2f3a4b5c6d7e8f90",
  sourceRepository: "https://github.com/nexoraorg/chenaikit",
  dependencies: [
    { name: "scikit-learn", version: "1.5.1" },
    { name: "numpy", version: "2.0.1" },
  ],
  configurationId: "sha256:0d4f0b0f…",
  createdAt: new Date().toISOString(),
});

if (!result.ok) {
  // result.missingFields / result.invalidFields name exactly what is wrong.
  throw new Error(result.error);
}

const payload = serializeProvenance(result.provenance);
```

- `createProvenance` stamps the current `formatVersion` and returns
  `{ ok: true, provenance }` only for complete input.
- `validateProvenance` inspects a candidate record without building one.
- `serializeProvenance` is the last gate before publishing.
- `parseProvenance` reads a payload back.

### Incomplete provenance is rejected, never silently accepted

Validation reports the offending field names, so a failed publish says what to
fix:

- **`missingFields`** — required fields that are absent, `null`, or blank.
- **`invalidFields`** — required fields that are present but malformed: an
  unknown `formatVersion`, a `createdAt` that is not ISO 8601, a non-array
  `dependencies`, or a dependency entry lacking a `name` or `version`.

A record is valid only when both lists are empty. Consequently:

- `createProvenance` returns `{ ok: false, error, missingFields, invalidFields }`
  and produces no record.
- `serializeProvenance` throws `ProvenanceValidationError` (carrying both lists)
  rather than emitting a half-populated payload, so an artifact cannot be
  published with partial provenance.
- `parseProvenance` returns a tagged failure with `reason` set to
  `"malformed-json"`, `"unsupported-format-version"`, or
  `"incomplete-provenance"`.

### Format compatibility

`parseProvenance` checks `formatVersion` before reading anything else. A payload
stamped with a version this build does not understand is rejected with
`reason: "unsupported-format-version"` — it is never interpreted on a
best-effort basis. The versions a build accepts are listed in
`SUPPORTED_PROVENANCE_FORMAT_VERSIONS`.

Bump `PROVENANCE_FORMAT_VERSION` whenever the required fields or their meaning
change, and keep older versions in `SUPPORTED_PROVENANCE_FORMAT_VERSIONS` only
while they remain readable.

### On-chain attestation

The Soroban `model-attestation` contract
([`contracts/model-attestation/src/lib.rs`](../contracts/model-attestation/src/lib.rs))
documents which of these fields an attestation can carry, and exposes them
on-chain via `provenance_fields()` alongside the format version it is compatible
with (`provenance_format_version()`). Its field list mirrors format version 1's
required fields in the same canonical order; keep the two in sync when the
format changes.
