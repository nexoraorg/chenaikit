"""HTTP client for the ChenAIKit model registry & A/B experiment API."""

import os
from typing import Any, Dict, List, Optional

import requests

from .errors import ChenAIMLflowError, ConflictError, ModelNotFoundError, ValidationError
from .hashing import hash_artifact


class ModelRegistryClient:
    """Client for registering models, promoting versions, and managing
    A/B experiments against a ChenAIKit backend instance.

    Example:
        >>> client = ModelRegistryClient(base_url="http://localhost:3000/api/v2")
        >>> model = client.get_or_create_model("credit-scoring", task_type="credit_scoring")
        >>> version = client.register_version(
        ...     model_id=model["id"],
        ...     version="2.0.0",
        ...     artifact_path="models/credit_scoring_v2.joblib",
        ...     accuracy=0.91,
        ...     auc=0.94,
        ... )
        >>> client.promote_version(version["id"], approved_by="jane.doe")
    """

    def __init__(self, base_url: Optional[str] = None, timeout: float = 30.0):
        self.base_url = (base_url or os.environ.get("CHENAIKIT_API_URL", "http://localhost:3000/api/v2")).rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()

    def _request(self, method: str, path: str, **kwargs) -> Any:
        url = f"{self.base_url}{path}"
        response = self.session.request(method, url, timeout=self.timeout, **kwargs)

        if response.status_code == 404:
            raise ModelNotFoundError(response.text)
        if response.status_code == 409:
            raise ConflictError(response.text)
        if response.status_code == 400:
            raise ValidationError(response.text)
        if response.status_code >= 400:
            raise ChenAIMLflowError(f"Request failed ({response.status_code}): {response.text}")

        if response.status_code == 204 or not response.content:
            return None

        body = response.json()
        return body.get("data", body)

    # -- Model registry ----------------------------------------------------

    def register_model(self, name: str, task_type: str, description: str = "") -> Dict[str, Any]:
        return self._request(
            "POST",
            "/ml-models",
            json={"name": name, "taskType": task_type, "description": description},
        )

    def list_models(self) -> List[Dict[str, Any]]:
        return self._request("GET", "/ml-models")

    def get_or_create_model(self, name: str, task_type: str, description: str = "") -> Dict[str, Any]:
        for model in self.list_models():
            if model["name"] == name:
                return model
        return self.register_model(name, task_type, description)

    def register_version(
        self,
        model_id: str,
        version: str,
        artifact_path: str,
        content_hash: Optional[str] = None,
        framework_version: Optional[str] = None,
        accuracy: Optional[float] = None,
        precision: Optional[float] = None,
        recall: Optional[float] = None,
        f1_score: Optional[float] = None,
        auc: Optional[float] = None,
        training_data_uri: Optional[str] = None,
        hyperparameters: Optional[Dict[str, Any]] = None,
        dataset_version: Optional[str] = None,
        code_commit: Optional[str] = None,
        training_run_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Registers a new model version. If `content_hash` is omitted, it is
        computed locally from the artifact file (SHA256) before upload."""
        computed_hash = content_hash or hash_artifact(artifact_path)

        payload = {
            "version": version,
            "artifactUri": artifact_path,
            "contentHash": computed_hash,
            "frameworkVersion": framework_version,
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1Score": f1_score,
            "auc": auc,
            "trainingDataUri": training_data_uri,
            "hyperparameters": hyperparameters or {},
            "datasetVersion": dataset_version,
            "codeCommit": code_commit,
            "trainingRunId": training_run_id,
        }
        payload = {k: v for k, v in payload.items() if v is not None}

        return self._request("POST", f"/ml-models/{model_id}/versions", json=payload)

    def list_versions(self, model_id: str, stage: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"stage": stage} if stage else {}
        return self._request("GET", f"/ml-models/{model_id}/versions", params=params)

    def get_production_version(self, model_id: str) -> Optional[Dict[str, Any]]:
        return self._request("GET", f"/ml-models/{model_id}/versions/production")

    def promote_version(self, version_id: str, approved_by: str) -> Dict[str, Any]:
        """Promotes a staging version to production. Requires an approval
        gate: `approved_by` must identify the approving actor."""
        return self._request(
            "POST",
            f"/ml-models/versions/{version_id}/promote",
            json={"approvedBy": approved_by},
        )

    def rollback(self, model_id: str, target_version_id: str, actor: str) -> Dict[str, Any]:
        return self._request(
            "POST",
            f"/ml-models/{model_id}/rollback",
            json={"targetVersionId": target_version_id, "actor": actor},
        )

    def record_drift_check(
        self,
        version_id: str,
        window_start: str,
        window_end: str,
        baseline_auc: float,
        observed_auc: float,
        alert_threshold_pct: Optional[float] = None,
        canary_threshold_pct: Optional[float] = None,
        auto_rollback_actor: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = {
            "windowStart": window_start,
            "windowEnd": window_end,
            "baselineAuc": baseline_auc,
            "observedAuc": observed_auc,
            "alertThresholdPct": alert_threshold_pct,
            "canaryThresholdPct": canary_threshold_pct,
            "autoRollbackActor": auto_rollback_actor,
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        return self._request("POST", f"/ml-models/versions/{version_id}/drift-checks", json=payload)

    # -- Experiments ---------------------------------------------------------

    def create_experiment(
        self,
        key: str,
        name: str,
        model_id: str,
        metric: str,
        variants: List[Dict[str, Any]],
        hypothesis: str = "",
        minimum_detectable_effect: Optional[float] = None,
        significance_level: float = 0.05,
        power: float = 0.8,
        bonferroni_correction: Optional[bool] = None,
        canary_threshold_pct: float = 5.0,
        canary_window_hours: int = 24,
    ) -> Dict[str, Any]:
        """Creates an A/B experiment.

        `variants` is a list of dicts: `{"name": str, "modelVersionId": str,
        "trafficWeight": float, "isControl": bool}`. Traffic weights must sum
        to 100 (e.g. a 90/10 rollout is `[{"trafficWeight": 90, ...},
        {"trafficWeight": 10, ...}]`).
        """
        payload = {
            "key": key,
            "name": name,
            "modelId": model_id,
            "metric": metric,
            "hypothesis": hypothesis,
            "minimumDetectableEffect": minimum_detectable_effect,
            "significanceLevel": significance_level,
            "power": power,
            "bonferroniCorrection": bonferroni_correction,
            "canaryThresholdPct": canary_threshold_pct,
            "canaryWindowHours": canary_window_hours,
            "variants": variants,
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        return self._request("POST", "/ml-models/experiments", json=payload)

    def start_experiment(self, experiment_id: str) -> Dict[str, Any]:
        return self._request("POST", f"/ml-models/experiments/{experiment_id}/start")

    def pause_experiment(self, experiment_id: str) -> Dict[str, Any]:
        return self._request("POST", f"/ml-models/experiments/{experiment_id}/pause")

    def complete_experiment(self, experiment_id: str) -> Dict[str, Any]:
        return self._request("POST", f"/ml-models/experiments/{experiment_id}/complete")

    def assign_variant(self, experiment_id: str, subject_id: str) -> Dict[str, Any]:
        return self._request(
            "POST",
            f"/ml-models/experiments/{experiment_id}/assign",
            json={"subjectId": subject_id},
        )

    def track_conversion(self, experiment_id: str, subject_id: str, metric_value: Optional[float] = None) -> None:
        payload: Dict[str, Any] = {"subjectId": subject_id}
        if metric_value is not None:
            payload["metricValue"] = metric_value
        self._request("POST", f"/ml-models/experiments/{experiment_id}/convert", json=payload)

    def get_results(self, experiment_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/ml-models/experiments/{experiment_id}/results")
