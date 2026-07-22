# chenai-mlflow

Python SDK for the ChenAIKit ML model registry and A/B testing framework.
Use it from training scripts to register model versions, promote them
through the staging -> production approval gate, and drive A/B experiments.

## Install

```bash
pip install -e packages/chenai-mlflow
```

## Usage

```python
from chenai_mlflow import ModelRegistryClient

client = ModelRegistryClient(base_url="http://localhost:3000/api/v2")

model = client.get_or_create_model("credit-scoring", task_type="credit_scoring")

version = client.register_version(
    model_id=model["id"],
    version="2.0.0",
    artifact_path="ml/models/credit_scoring_v2.joblib",
    accuracy=0.91,
    auc=0.94,
    code_commit="abc1234",
    training_run_id="run-042",
)

# Promotion requires an approval gate.
client.promote_version(version["id"], approved_by="jane.doe")
```

### A/B testing

```python
experiment = client.create_experiment(
    key="credit-score-v2-rollout",
    name="Credit score v2 vs v1",
    model_id=model["id"],
    metric="approval_rate",
    minimum_detectable_effect=0.02,
    variants=[
        {"name": "control", "modelVersionId": v1_id, "trafficWeight": 90, "isControl": True},
        {"name": "treatment", "modelVersionId": v2_id, "trafficWeight": 10},
    ],
)
client.start_experiment(experiment["id"])

variant = client.assign_variant(experiment["id"], subject_id="user-123")
client.track_conversion(experiment["id"], subject_id="user-123")

results = client.get_results(experiment["id"])
```

## Configuration

The client reads `CHENAIKIT_API_URL` if `base_url` is not passed explicitly
(defaults to `http://localhost:3000/api/v2`).

## Development

```bash
cd packages/chenai-mlflow
pip install -e ".[dev]"
pytest
```
