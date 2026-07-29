"""Machine-readable and Markdown model-card generation."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
from hashlib import sha256
import json


def compute_model_hash(artifact_path: str, metadata: dict[str, Any] | None = None) -> str:
    """
    Compute a reproducible hash for a model artifact.
    This hash is used for model version approval in the oracle network.
    
    Args:
        artifact_path: Path to the model artifact file
        metadata: Optional metadata to include in the hash
    
    Returns:
        SHA256 hash of the model artifact
    """
    with open(artifact_path, 'rb') as f:
        artifact_bytes = f.read()
    
    # Compute hash of artifact bytes
    artifact_hash = sha256(artifact_bytes).hexdigest()
    
    # If metadata is provided, include it in the hash for reproducibility
    if metadata:
        canonical_metadata = json.dumps(metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        combined = artifact_hash + canonical_metadata
        return sha256(combined.encode()).hexdigest()
    
    return artifact_hash


def verify_model_hash(artifact_path: str, expected_hash: str, metadata: dict[str, Any] | None = None) -> bool:
    """
    Verify that a model artifact matches the expected hash.
    
    Args:
        artifact_path: Path to the model artifact file
        expected_hash: Expected SHA256 hash
        metadata: Optional metadata used during hash computation
    
    Returns:
        True if hash matches, False otherwise
    """
    computed_hash = compute_model_hash(artifact_path, metadata)
    return computed_hash == expected_hash


def generate_model_card(metadata: dict[str, Any], report: dict[str, Any], policy_result: dict[str, Any]) -> dict[str, Any]:
    required = ("modelVersion", "artifactHash", "datasetHash", "codeCommit", "intendedUses",
                "prohibitedUses", "limitations", "explanationMethod")
    missing = [key for key in required if not metadata.get(key)]
    if missing:
        raise ValueError(f"Missing model-card fields: {', '.join(missing)}")
    
    card = {**metadata, "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
            "performance": report.get("metrics", {}), "cohortPerformance": report.get("cohorts", {}),
            "policyResult": policy_result}
    card["notice"] = "Fairness metrics support governance review; they do not establish legal or regulatory compliance."
    
    # Add oracle network compatibility info
    card["oracleNetwork"] = {
        "modelHash": metadata.get("artifactHash"),
        "approvedForOracle": metadata.get("approvedForOracle", False),
        "oracleMetadata": metadata.get("oracleMetadata", {})
    }
    
    return card
