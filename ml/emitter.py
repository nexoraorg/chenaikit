"""ModelResult emitter adhering strictly to the chenai-mlflow data contract.

Wraps model inferences into verified ModelResult payloads and supports
attestation metadata generation matching Soroban model-attestation requirements.
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional

from contract import (
    MODEL_RESULT_SCHEMA_VERSION,
    impute_feature_vector,
    validate_model_result,
)
from models import vector_to_features


def _get_utc_timestamp() -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class ModelResultEmitter:
    """Emits contract-compliant ModelResult dictionaries from model inferences."""

    def __init__(self, artifact_hashes: Optional[Dict[str, str]] = None) -> None:
        """Initialize the emitter with optional model artifact digests."""
        self.artifact_hashes = artifact_hashes or {}

    def score_and_emit(
        self,
        model: Any,
        raw_or_imputed_vector: Dict[str, Any],
        task: str,
        scored_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute inference on a feature vector and emit a validated ModelResult."""
        if "imputedFields" in raw_or_imputed_vector:
            imputed_vector = raw_or_imputed_vector
            imputed_fields = list(raw_or_imputed_vector["imputedFields"])
        else:
            imputed_vector, imputed_fields = impute_feature_vector(raw_or_imputed_vector)

        feature_row = vector_to_features(imputed_vector)
        score, label, confidence = model.predict_risk(feature_row)

        effective_scored_at = scored_at or _get_utc_timestamp()

        result: Dict[str, Any] = {
            "schemaVersion": MODEL_RESULT_SCHEMA_VERSION,
            "modelId": getattr(model, "MODEL_ID", f"{task}-model"),
            "modelVersion": getattr(model, "MODEL_VERSION", "1.0.0"),
            "featureVectorVersion": imputed_vector.get("schemaVersion", "1.0.0"),
            "task": task,
            "subjectId": imputed_vector["subjectId"],
            "scoredAt": effective_scored_at,
            "score": score,
            "label": label,
            "confidence": confidence,
            "imputedFields": imputed_fields,
        }

        return validate_model_result(result)

    def get_attestation_payload(
        self,
        result: Dict[str, Any],
        artifact_hash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create an attestation payload binding ModelResult to a 32-byte artifact hash."""
        target_hash = artifact_hash or self.artifact_hashes.get(result["modelId"], "")
        return {
            "modelResult": result,
            "artifactHash": target_hash,
            "attestationTarget": "contracts/model-attestation",
        }
