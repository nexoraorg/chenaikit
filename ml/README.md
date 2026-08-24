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
```
