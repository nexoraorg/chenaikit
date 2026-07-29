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


class OracleNetworkPolicy(BaseModel):
    """Policy for oracle network model approval requirements."""
    requireReproducibleHash: bool = Field(True, description="Require reproducible model hash for oracle network")
    requireGovernanceApproval: bool = Field(True, description="Require governance approval for oracle deployment")
    maxModelSizeBytes: int = Field(1073741824, ge=0, description="Maximum model size in bytes (1GB default)")
    minModelAccuracy: str = Field(">=0.85", description="Minimum accuracy threshold for oracle models")
    requireDriftDetection: bool = Field(True, description="Require drift detection capability")


class GovernancePolicy(BaseModel):
    schemaVersion: int = Field(1, ge=1)
    minimumDatasetRows: int = Field(10000, ge=1)
    minimumCohortSize: int = Field(100, ge=1)
    requiredMetrics: dict[str, str]
    fairness: dict[str, str]
    explainability: ExplainabilityPolicy = Field(default_factory=ExplainabilityPolicy)
    oracleNetwork: OracleNetworkPolicy = Field(default_factory=OracleNetworkPolicy)
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
    
    # Oracle network specific checks
    if policy.oracleNetwork.requireReproducibleHash:
        model_hash = report.get("modelHash")
        checks.append({
            "name": "oracleNetwork.reproducibleHash",
            "actual": model_hash is not None,
            "threshold": "hash_present",
            "passed": model_hash is not None,
            "reason": None if model_hash else "model_hash_required_for_oracle"
        })
    
    if policy.oracleNetwork.requireGovernanceApproval:
        governance_approved = report.get("governanceApproved", False)
        checks.append({
            "name": "oracleNetwork.governanceApproval",
            "actual": governance_approved,
            "threshold": "approved",
            "passed": governance_approved,
            "reason": None if governance_approved else "governance_approval_required"
        })
    
    model_size = report.get("modelSizeBytes")
    if model_size is not None:
        checks.append({
            "name": "oracleNetwork.modelSize",
            "actual": model_size,
            "threshold": f"<={policy.oracleNetwork.maxModelSizeBytes}",
            "passed": model_size <= policy.oracleNetwork.maxModelSizeBytes,
            "reason": None if model_size <= policy.oracleNetwork.maxModelSizeBytes else "model_too_large"
        })
    
    suppressed = report.get("fairness", {}).get("suppressedCohorts", [])
    if suppressed:
        checks.append({"name": "fairness.minimumCohortSize", "actual": suppressed, "threshold": "none suppressed",
                       "passed": False, "reason": "suppressed_cohorts_cannot_pass"})
    passed = all(c["passed"] for c in checks)
    return {"schemaVersion": 1, "passed": passed, "decision": "pass" if passed else policy.onFailure,
            "checks": checks, "policyHash": hash_document(policy.model_dump()),
            "reportHash": hash_document(report)}


def evaluate_oracle_readiness(policy: GovernancePolicy, report: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate if a model is ready for oracle network deployment.
    This is a stricter evaluation focused on oracle-specific requirements.
    
    Args:
        policy: Governance policy with oracle network requirements
        report: Model evaluation report
    
    Returns:
        Oracle readiness evaluation result
    """
    oracle_checks = []
    
    # Check reproducible hash
    if policy.oracleNetwork.requireReproducibleHash:
        model_hash = report.get("modelHash")
        oracle_checks.append({
            "name": "reproducibleHash",
            "passed": model_hash is not None,
            "actual": model_hash,
            "required": True
        })
    
    # Check governance approval
    if policy.oracleNetwork.requireGovernanceApproval:
        governance_approved = report.get("governanceApproved", False)
        oracle_checks.append({
            "name": "governanceApproval",
            "passed": governance_approved,
            "actual": governance_approved,
            "required": True
        })
    
    # Check model size
    model_size = report.get("modelSizeBytes")
    if model_size is not None:
        oracle_checks.append({
            "name": "modelSize",
            "passed": model_size <= policy.oracleNetwork.maxModelSizeBytes,
            "actual": model_size,
            "required": True,
            "max": policy.oracleNetwork.maxModelSizeBytes
        })
    
    # Check minimum accuracy
    accuracy = report.get("metrics", {}).get("accuracy")
    if accuracy is not None:
        match = re.fullmatch(r"\s*(>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)\s*", policy.oracleNetwork.minModelAccuracy)
        if match:
            min_acc = float(match.group(2))
            passed = OPS[match.group(1)](accuracy, min_acc)
            oracle_checks.append({
                "name": "accuracy",
                "passed": passed,
                "actual": accuracy,
                "required": True,
                "threshold": policy.oracleNetwork.minModelAccuracy
            })
    
    # Check drift detection capability
    if policy.oracleNetwork.requireDriftDetection:
        drift_detection = report.get("driftDetectionEnabled", False)
        oracle_checks.append({
            "name": "driftDetection",
            "passed": drift_detection,
            "actual": drift_detection,
            "required": True
        })
    
    passed = all(c["passed"] for c in oracle_checks)
    
    return {
        "readyForOracle": passed,
        "checks": oracle_checks,
        "policyHash": hash_document(policy.oracleNetwork.model_dump()),
        "reportHash": hash_document(report)
    }
