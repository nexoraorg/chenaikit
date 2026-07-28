"""Machine-readable and Markdown model-card generation."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any


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
    return card
