# Model Deployment Runbook

Operational steps for taking a trained model from artifact to production
using the ChenAIKit model registry.

## Components

- **Registry API**: `/api/v2/ml-models` (`backend/src/routes/mlModels.ts`)
- **Registry service**: `ModelRegistryService` (`backend/src/services/modelRegistryService.ts`)
- **Python SDK**: `chenai-mlflow` (`packages/chenai-mlflow`)
- **CI workflow**: `.github/workflows/model-deployment.yml`
- **Drift detector**: `ModelDriftDetector` (`backend/src/services/modelDriftDetector.ts`)

## 1. Register a model (one-time)

```python
from chenai_mlflow import ModelRegistryClient

client = ModelRegistryClient(base_url="https://api.example.com/api/v2")
model = client.register_model("credit-scoring", task_type="credit_scoring")
```

Or reuse an existing one: `client.get_or_create_model(...)`.

## 2. Register a new version after training

Every version is content-addressed: the SDK computes the SHA256 of the
artifact file locally and sends it alongside the artifact URI, so identical
uploads are always detectable and tampering is visible.

```python
version = client.register_version(
    model_id=model["id"],
    version="2.0.0",
    artifact_path="ml/models/credit_scoring_v2.joblib",
    accuracy=0.91,
    auc=0.94,
    code_commit=os.environ["GITHUB_SHA"],
    training_run_id=run_id,
)
```

New versions always start in the `staging` stage. This is enforced by
`ModelRegistryService.register()` — there is no way to register directly
into production.

## 3. Validate in staging

Run your evaluation suite against the staging version (see
`ml/evaluation/metrics.py` for the existing credit-scoring / fraud-detection
metrics). If you want a data-driven comparison rather than a single
go/no-go check, run it as an A/B experiment — see the
[experiment design guide](./experiment-design-guide.md).

## 4. Promote to production (approval gate)

Promotion requires an explicit approver and is not automatic:

```python
client.promote_version(version["id"], approved_by="jane.doe")
```

This call:
1. Archives whatever version is currently in `production` for this model.
2. Moves the target version to `production`, stamping `approvedBy` and
   `approvedAt`.

There is intentionally no "promote on merge" step in the CI workflow —
`register-and-deploy` only registers the artifact; promotion is a separate,
human-triggered action.

## 5. Monitor for drift

Feed periodic AUC measurements (e.g. from a scheduled batch job scoring
production traffic against ground truth) into the drift detector:

```python
client.record_drift_check(
    version_id=production_version["id"],
    window_start=window_start.isoformat(),
    window_end=window_end.isoformat(),
    baseline_auc=0.94,
    observed_auc=0.905,
)
```

- Alerts when AUC drops more than **3%** from baseline (`alertThresholdPct`,
  configurable per call).
- Automatically rolls back to the previous production version when the drop
  exceeds the **canary threshold** (default 5%) — see
  [rollback procedures](./rollback-procedures.md) for what that does under
  the hood.

## 6. CI/CD

`.github/workflows/model-deployment.yml` runs on pushes touching `ml/**`:

1. `train` — regenerates synthetic data, preprocesses, trains.
2. `validate` — runs `ml/evaluation/metrics.py` as a gate; the job fails (and
   blocks registration) if evaluation errors out.
3. `register-and-deploy` — registers the resulting artifact with the
   registry via `chenai-mlflow`. Promotion is left manual (see step 4).
