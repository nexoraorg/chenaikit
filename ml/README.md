# ml

Python ML pipeline. Scope unchanged from the pre-migration `ml/` — re-audit
contents during the restructure but no relocation planned.

## Evaluation reports

`evaluation_report.py` generates a small, versioned metadata record that is
persisted next to the metrics output, so results can be compared or audited
later without guessing which model/data/config produced them.

The TypeScript counterpart lives in
[`packages/chenai-mlflow`](../packages/chenai-mlflow) and exposes the same
schema to TS consumers.

### Report format (schema version `1.0`)

```json
{
  "schema_version": "1.0",
  "report_id": "er-<16 hex chars>",
  "generated_at": "2026-01-15T10:00:00Z",
  "model": { "name": "credit-score", "version": "1.2.0" },
  "dataset": { "identifier": "chena-loans-2024", "version": "3" },
  "evaluation": {
    "config_id": "eval-2024-06-config",
    "params": { "threshold": 0.5, "cv_folds": 5 }
  },
  "metrics": { "accuracy": 0.91 },
  "code_version": "abc1234"
}
```

| Field             | Required | Meaning                                            |
|-------------------|----------|----------------------------------------------------|
| `schema_version`  | yes      | Report schema version, currently `1.0`             |
| `report_id`       | yes      | `er-` + first 16 hex chars of the SHA-256 digest of the canonical report body |
| `generated_at`    | yes      | ISO-8601 UTC timestamp                             |
| `model.*`         | yes      | Model `name` and `version`                         |
| `dataset.*`       | yes      | Dataset `identifier` and `version`                 |
| `evaluation.config_id` | yes | Identifier of the evaluation configuration         |
| `evaluation.params`    | no  | Scalar evaluation parameters                       |
| `metrics`         | yes      | Scalar metric values                               |
| `code_version`    | no       | Code revision (e.g. git commit) used for the run   |

### Guarantees

- **Deterministic serialization** — canonical JSON: recursively sorted keys,
  no whitespace, ASCII escaping. Identical inputs produce identical bytes and
  identical `report_id`s.
- **Versioned** — every report carries `schema_version`; loaders reject
  unsupported versions.
- **Tamper-evident** — `report_id` is derived from the report contents;
  modifying anything invalidates it.
- **No training data** — metric/parameter values must be JSON scalars
  (`string`/`int`/`float`/`bool`/`null`). Containers are rejected, strings are
  capped at 512 chars, and keys that look like raw data (`records`, `rows`,
  `samples`, `raw_data`, `training_data`, …) are refused. Aggregate counts
  such as `n_samples` are fine.

### Usage

```python
from evaluation_report import create_evaluation_report, persist_report, load_report

report = create_evaluation_report(
    model={"name": "credit-score", "version": "1.2.0"},
    dataset={"identifier": "chena-loans-2024", "version": "3"},
    evaluation={"config_id": "eval-2024-06-config", "params": {"threshold": 0.5}},
    metrics={"accuracy": 0.91},
)

# Writes evaluation_report.json (+ metrics.json) atomically.
persist_report(report, "runs/exp-42", metrics={"accuracy": 0.91})

loaded = load_report("runs/exp-42/evaluation_report.json")  # revalidated on load
```

Pass an explicit `generated_at` when you need byte-for-byte reproducible
output; otherwise it defaults to the current UTC time.

### Tests

```bash
python3 -m unittest discover -s ml/tests -v
---

# ML pipeline data contract

This document is the reference for everything that crosses the boundary between
the Python pipeline in this directory and the TypeScript services that consume
its output. Two payloads cross that boundary:

| Direction | Payload | Contract | Version |
| --- | --- | --- | --- |
| **In** — feature store → model | `FeatureVector` | one scored subject | `1.0.0` |
| **Out** — model → API / Soroban | `ModelResult` | one model verdict | `1.0.0` |

Both are **JSON objects**, one per subject, newline-delimited when batched.

The contract is not prose-only. The machine-readable half lives in
[`packages/chenai-mlflow/src/index.ts`](../packages/chenai-mlflow/src/index.ts)
as exported TypeScript types plus validators that enforce every rule described
below, and it is exercised by
[`packages/chenai-mlflow/src/index.test.ts`](../packages/chenai-mlflow/src/index.test.ts).
**When this document and that module disagree, the module wins** — it is what
actually rejects bad payloads at runtime. Amend both together.

```ts
import {
  validateFeatureVector,   // throws SchemaValidationError, returns FeatureVector
  isFeatureVector,         // non-throwing type guard
  imputeFeatureVector,     // validate, then apply the missing-value policy
  validateModelResult,
  isModelResult,
  NUMERIC_FEATURE_SPECS,   // the field table below, as data
  EXAMPLE_FEATURE_VECTOR,
  EXAMPLE_MODEL_RESULT,
} from "@chenaikit/chenai-mlflow";
```

## Pipeline inventory

```
Stellar Horizon / ingest  ──▶  feature builder  ──▶  FeatureVector  (contract, versioned)
                                                          │
                                                    imputeFeatureVector
                                                          │
                                                          ▼
                                                   model (credit-score | fraud-detect)
                                                          │
                                                          ▼
                                                    ModelResult  (contract, versioned)
                                                          │
                                        ┌─────────────────┴─────────────────┐
                                        ▼                                   ▼
                              apps/backend API                  Soroban: contracts/credit-score,
                                                                contracts/fraud-detect
```

Two model heads share both contracts, distinguished by `ModelResult.task`:

- `credit-score` — creditworthiness of an account, mirroring
  `contracts/credit-score`.
- `fraud-detect` — anomaly risk of an account or a single payment, mirroring
  `contracts/fraud-detect`.

## Conventions that apply to every field

- **Timestamps** are ISO-8601 in **UTC**, always ending in `Z`, with optional
  milliseconds: `2026-01-15T00:00:00.000Z`. Local offsets such as `+01:00` are
  rejected outright rather than normalised, so that no ambiguity survives into
  training data.
- **Money** is expressed in **stroops** — integers, never decimals.
  `1 XLM = 10_000_000 stroops` (exported as `STROOPS_PER_XLM`). Amounts must
  stay within `Number.MAX_SAFE_INTEGER`; a producer holding a larger value must
  fail rather than round.
- **Ratios** are floats in the closed interval `[0, 1]`, not percentages.
- **Counts** are non-negative integers.
- **`subjectId`** is an opaque pseudonymous identifier matching
  `[A-Za-z0-9_-]{1,128}`. It must never carry personal data. The pattern is
  itself a safeguard: it rejects email addresses and anything else containing
  `@`, `.`, or whitespace.
- **Unknown fields are rejected.** A payload carrying a key the contract does
  not define is a version mismatch, and silently ignoring it would let a
  producer believe it is sending a signal that no model reads.

## Input: `FeatureVector`

### Identity and provenance

| Field | Type | Unit | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `schemaVersion` | `string` | semver | no | Must equal the version this build implements (`1.0.0`). A payload from a future schema is rejected, not best-effort parsed. |
| `subjectId` | `string` | — | no | Opaque pseudonymous id, `[A-Za-z0-9_-]{1,128}`. |
| `subjectKind` | `"account" \| "transaction"` | — | no | What `subjectId` names. |
| `observedAt` | `string` | ISO-8601 UTC | no | The instant the features are computed *as of*. All trailing windows below end here. |
| `kycTier` | `0 \| 1 \| 2 \| 3` | tier | no | Customer due-diligence level. **Deliberately not nullable** — the caller always knows what it has on file, and "unverified" is precisely what tier `0` means. A `null` here would be indistinguishable from tier `0` while carrying different intent. |

### Numeric features

All nine are `number | null`. Each row's bounds and default are the same values
the validator enforces — they come from the exported `NUMERIC_FEATURE_SPECS`
table, so the documentation and the code cannot drift.

| Field | Unit | Type | Range | Missing → | Meaning |
| --- | --- | --- | --- | --- | --- |
| `accountAgeDays` | days | integer | `0 … 36500` | `0` | Whole days between account creation and `observedAt`. |
| `transactionCount30d` | count | integer | `0 … 1e9` | `0` | Settled payments in the trailing 30 days. |
| `averageBalanceStroops` | stroops | integer | `0 … 2^53-1` | `0` | Time-weighted mean native balance over the trailing 30 days. |
| `largestTransferStroops` | stroops | integer | `0 … 2^53-1` | `0` | Largest single outbound payment in the trailing 30 days. |
| `distinctCounterparties30d` | count | integer | `0 … 1e9` | `0` | Distinct counterparty accounts in the trailing 30 days. |
| `failedPaymentCount90d` | count | integer | `0 … 1e9` | `0` | Payments that failed or were reverted in the trailing 90 days. |
| `disputeRatio90d` | ratio | float | `0 … 1` | `0` | Disputed ÷ total payments over the trailing 90 days. |
| `crossBorderTransferRatio30d` | ratio | float | `0 … 1` | `0` | Share of 30-day payment volume whose counterparty anchor is in another jurisdiction. |
| `medianSettlementLatencySeconds` | seconds | float | `0 … 2592000` | **`86400`** | Median seconds from submission to ledger close over the trailing 30 days. |

### Missing-value behaviour

The rules below are enforced by `validateFeatureVector` and
`imputeFeatureVector`, not merely recommended.

1. **`null` means "the upstream source had no value."** It is the only way to
   express missing data.
2. **The key must still be present.** An absent key is a producer bug — it
   means the builder never considered the field — and is rejected with
   `"<field> is required; use an explicit null to signal a missing value"`.
   Treating absence as `null` would let a partially-implemented feature builder
   silently ship vectors that look complete.
3. **`undefined` is rejected** for the same reason, so a payload cannot lose
   the distinction by round-tripping through a language that conflates the two.
   Note that `JSON.stringify` drops `undefined` values, which turns rule 3 into
   rule 2 on the wire — both are rejections.
4. **Imputation happens in exactly one place:** `imputeFeatureVector`. It
   validates, replaces each `null` with that field's documented default, and
   returns an `ImputedFeatureVector` whose `imputedFields` array names every
   field it filled. Models consume the imputed vector; nothing else is allowed
   to invent values.
5. **Defaults lean risk-averse, not mechanically toward zero.** Most unknowns
   default to `0` because zero *is* the conservative reading — an account of
   unknown age is treated as brand new, unknown balance as no balance.
   `medianSettlementLatencySeconds` is the exception: `0` would assert instant
   settlement, the most *favourable* possible value, so unknown latency imputes
   to one day (`86400`).
6. **`imputedFields` is carried through to the output** so that a consumer, and
   any downstream Soroban contract, can tell a confident score from one built
   partly on defaults.

### Invalid-data behaviour

`validateFeatureVector` throws `SchemaValidationError`, whose `issues` array
lists **every** violation found — not just the first — so a broken producer can
be fixed in one pass. Rejected, specifically:

- a payload that is not a plain object (arrays, `null`, primitives);
- an unknown field name;
- a `schemaVersion` that is not semver, or that this build does not implement;
- a `subjectId` that does not match the opaque-id pattern (this is what catches
  personal data leaking into the id);
- an `observedAt` that is not UTC ISO-8601, or is not a real calendar instant;
- `NaN` or `Infinity` in any numeric field — these are never "missing", they
  are a computation that went wrong upstream, and they must not be laundered
  into a default;
- a fractional value in an integer field, or a numeric value supplied as a
  string;
- any value outside its documented range, including negative counts and
  amounts, and ratios above `1`.

There is no lenient or coercing mode. A caller that wants a boolean instead of
an exception uses the `isFeatureVector` type guard.

### Example — complete

```json
{
  "schemaVersion": "1.0.0",
  "subjectId": "synthetic-account-0001",
  "subjectKind": "account",
  "observedAt": "2026-01-15T00:00:00.000Z",
  "kycTier": 2,
  "accountAgeDays": 418,
  "transactionCount30d": 37,
  "averageBalanceStroops": 1250000000,
  "largestTransferStroops": 400000000,
  "distinctCounterparties30d": 12,
  "failedPaymentCount90d": 1,
  "disputeRatio90d": 0.0,
  "crossBorderTransferRatio30d": 0.24,
  "medianSettlementLatencySeconds": 5.4
}
```

`averageBalanceStroops: 1250000000` is 125 XLM; `largestTransferStroops:
400000000` is 40 XLM.

### Example — with missing values

Three upstream sources were unavailable, so those fields are explicitly `null`:

```json
{
  "schemaVersion": "1.0.0",
  "subjectId": "synthetic-account-0002",
  "subjectKind": "account",
  "observedAt": "2026-01-15T00:00:00.000Z",
  "kycTier": 0,
  "accountAgeDays": null,
  "transactionCount30d": 2,
  "averageBalanceStroops": null,
  "largestTransferStroops": 90000000,
  "distinctCounterparties30d": 2,
  "failedPaymentCount90d": 0,
  "disputeRatio90d": 0.0,
  "crossBorderTransferRatio30d": 1.0,
  "medianSettlementLatencySeconds": null
}
```

Passing this through `imputeFeatureVector` yields `accountAgeDays: 0`,
`averageBalanceStroops: 0`, `medianSettlementLatencySeconds: 86400`, and
`imputedFields: ["accountAgeDays", "averageBalanceStroops",
"medianSettlementLatencySeconds"]`.

Both examples are exported as `EXAMPLE_FEATURE_VECTOR` and
`EXAMPLE_FEATURE_VECTOR_WITH_GAPS`, and the test suite asserts that they
validate — so a documented example that stops being valid fails CI.

## Output: `ModelResult`

| Field | Type | Unit | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `schemaVersion` | `string` | semver | no | Version of *this* contract (`1.0.0`). |
| `modelId` | `string` | — | no | Stable model identifier, `[A-Za-z0-9._-]{1,128}`, e.g. `credit-score-gbm`. |
| `modelVersion` | `string` | semver | no | Version of the trained artifact. `"latest"` and other floating tags are rejected — a score must be reproducible. |
| `featureVectorVersion` | `string` | semver | no | `schemaVersion` of the input that was scored. |
| `task` | `"credit-score" \| "fraud-detect"` | — | no | Which head produced the result. |
| `subjectId` | `string` | — | no | Echoes the input's `subjectId`. |
| `scoredAt` | `string` | ISO-8601 UTC | no | When the score was produced (distinct from `observedAt`, which is when the features were measured). |
| `score` | `number` | ratio | no | Continuous risk score in `[0, 1]`; **higher = riskier**, for both tasks. |
| `label` | `"low" \| "medium" \| "high"` | — | no | Discrete bucket from the model's calibrated thresholds. Consumers that need a class must read `label` rather than re-thresholding `score`, so that recalibration stays inside the model. |
| `confidence` | `number` | ratio | no | Calibrated confidence in `label`, in `[0, 1]`. Independent of `score`: a confidently low-risk subject is `score: 0.05, confidence: 0.95`. |
| `imputedFields` | `string[]` | — | no | Names of input features that were imputed. `[]` when the input was complete. Every entry must be a known feature name. |

### Missing and invalid data on the output side

**No field of `ModelResult` is nullable, and there is no partial result.** A
model that cannot score a subject emits nothing at all and records the failure
out of band. This is deliberate: the downstream consumers include Soroban
contracts, which cannot distinguish "unknown" from "benign" — a `null` score
arriving on-chain would be read as an absence of risk.

`imputedFields` must be present even when empty. Omitting it is rejected,
because an absent array and an empty array would otherwise both read as "nothing
was imputed", and only one of them actually means that.

`validateModelResult` rejects, again reporting every issue at once: unknown
fields, a `schemaVersion` this build does not implement, non-semver versions, a
`score` or `confidence` outside `[0, 1]`, an unrecognised `task` or `label`, a
`subjectId` that could carry personal data, a malformed `scoredAt`, and any
`imputedFields` entry that is not a defined feature name.

### Example

```json
{
  "schemaVersion": "1.0.0",
  "modelId": "credit-score-gbm",
  "modelVersion": "2.3.1",
  "featureVectorVersion": "1.0.0",
  "task": "credit-score",
  "subjectId": "synthetic-account-0001",
  "scoredAt": "2026-01-15T00:00:03.412Z",
  "score": 0.17,
  "label": "low",
  "confidence": 0.91,
  "imputedFields": []
}
```

And the result for the vector with gaps, reporting what it had to fill in:

```json
{
  "schemaVersion": "1.0.0",
  "modelId": "fraud-detect-iforest",
  "modelVersion": "0.9.0",
  "featureVectorVersion": "1.0.0",
  "task": "fraud-detect",
  "subjectId": "synthetic-account-0002",
  "scoredAt": "2026-01-15T00:00:03.907Z",
  "score": 0.78,
  "label": "high",
  "confidence": 0.62,
  "imputedFields": [
    "accountAgeDays",
    "averageBalanceStroops",
    "medianSettlementLatencySeconds"
  ]
}
```

Exported as `EXAMPLE_MODEL_RESULT` and
`EXAMPLE_MODEL_RESULT_WITH_IMPUTATION`.

## All example data is synthetic

Every value in this document and in the exported examples was fabricated by
hand. The `subjectId`s are literal placeholders (`synthetic-account-0001`), not
hashes or obfuscations of anything real; no field derives from a real account,
person, or ledger entry. The test suite asserts that every exported example's
`subjectId` begins with `synthetic-`, so a real identifier cannot be pasted in
without failing CI.

Contributors adding examples must keep them fabricated. Real production values
do not belong in this repository even when the identifiers look opaque.

## Versioning

`FeatureVector` and `ModelResult` are versioned independently, both semver:

- **patch** — documentation or wording only, no change to accepted payloads;
- **minor** — a new *nullable* field, or a widened range: producers on the older
  version stay valid;
- **major** — anything else: a removed or renamed field, a narrowed range, a new
  required field, or a changed imputation default.

Because a validator rejects any `schemaVersion` it does not implement, a bump
requires updating `FEATURE_VECTOR_SCHEMA_VERSION` /
`MODEL_RESULT_SCHEMA_VERSION`, the examples, this document, and the tests in the
same change.

## Verifying the contract

```bash
pnpm --filter @chenaikit/chenai-mlflow run build   # tsc -p tsconfig.json
pnpm --filter @chenaikit/chenai-mlflow run test    # vitest run
```
