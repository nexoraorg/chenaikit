"""Versioned responsible-model policy and deterministic gate evaluation."""
from __future__ import annotations
from hashlib import sha256
import json
import operator
import re
from typing import Any
from pydantic import BaseModel, Field


class ExplainabilityPolicy(BaseModel):
    additivityPassRate: str = ">=0.99"
    maxP95ExplanationMs: float = 250


class GovernancePolicy(BaseModel):
    schemaVersion: int = Field(1, ge=1)
    minimumDatasetRows: int = Field(10000, ge=1)
    minimumCohortSize: int = Field(100, ge=1)
    requiredMetrics: dict[str, str]
    fairness: dict[str, str]
    explainability: ExplainabilityPolicy = Field(default_factory=ExplainabilityPolicy)
    onFailure: str = Field("block", pattern="^(block|warn)$")


OPS = {">=": operator.ge, "<=": operator.le, ">": operator.gt, "<": operator.lt, "==": operator.eq}


def hash_document(value: Any) -> str:
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return sha256(canonical.encode()).hexdigest()


def _check(name: str, actual: float | None, expression: str) -> dict[str, Any]:
    match = re.fullmatch(r"\s*(>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)\s*", expression)
    if not match:
        raise ValueError(f"Invalid threshold for {name}: {expression}")
    passed = actual is not None and OPS[match.group(1)](actual, float(match.group(2)))
    return {"name": name, "actual": actual, "threshold": expression, "passed": passed,
            "reason": None if passed else ("metric_missing" if actual is None else "threshold_not_met")}


def evaluate_policy(policy: GovernancePolicy, report: dict[str, Any]) -> dict[str, Any]:
    checks = [_check("datasetRows", report.get("datasetRows"), f">={policy.minimumDatasetRows}")]
    checks += [_check(f"metrics.{k}", report.get("metrics", {}).get(k), v) for k, v in policy.requiredMetrics.items()]
    checks += [_check(f"fairness.{k}", report.get("fairness", {}).get(k), v) for k, v in policy.fairness.items()]
    checks += [
        _check("explainability.additivityPassRate", report.get("explainability", {}).get("additivityPassRate"),
               policy.explainability.additivityPassRate),
        _check("explainability.p95ExplanationMs", report.get("explainability", {}).get("p95ExplanationMs"),
               f"<={policy.explainability.maxP95ExplanationMs}"),
    ]
    suppressed = report.get("fairness", {}).get("suppressedCohorts", [])
    if suppressed:
        checks.append({"name": "fairness.minimumCohortSize", "actual": suppressed, "threshold": "none suppressed",
                       "passed": False, "reason": "suppressed_cohorts_cannot_pass"})
    passed = all(c["passed"] for c in checks)
    return {"schemaVersion": 1, "passed": passed, "decision": "pass" if passed else policy.onFailure,
            "checks": checks, "policyHash": hash_document(policy.model_dump()),
            "reportHash": hash_document(report)}
