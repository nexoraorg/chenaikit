"""Typed responsible-model governance contracts."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Mapping, Sequence

PolicyDecision = Literal["pass", "warn", "block"]
ThresholdOperator = Literal[">=", "<=", ">", "<", "=="]


@dataclass(frozen=True)
class ExplainabilityPolicy:
    additivity_pass_rate: str = ">=0.99"
    max_p95_explanation_ms: float = 250.0

    def to_api(self) -> dict[str, Any]:
        return {
            "additivityPassRate": self.additivity_pass_rate,
            "maxP95ExplanationMs": self.max_p95_explanation_ms,
        }


@dataclass(frozen=True)
class PromotionPolicy:
    minimum_dataset_rows: int
    minimum_cohort_size: int
    required_metrics: Mapping[str, str]
    fairness: Mapping[str, str]
    explainability: ExplainabilityPolicy = field(default_factory=ExplainabilityPolicy)
    on_failure: Literal["block", "warn"] = "block"
    schema_version: Literal[1] = 1

    def __post_init__(self) -> None:
        if self.minimum_dataset_rows < 1:
            raise ValueError("minimum_dataset_rows must be positive")
        if self.minimum_cohort_size < 1:
            raise ValueError("minimum_cohort_size must be positive")
        if self.on_failure not in {"block", "warn"}:
            raise ValueError("on_failure must be block or warn")

    def to_api(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schema_version,
            "minimumDatasetRows": self.minimum_dataset_rows,
            "minimumCohortSize": self.minimum_cohort_size,
            "requiredMetrics": dict(self.required_metrics),
            "fairness": dict(self.fairness),
            "explainability": self.explainability.to_api(),
            "onFailure": self.on_failure,
        }


@dataclass(frozen=True)
class EvaluationReport:
    model_artifact_hash: str
    dataset_hash: str
    code_commit: str
    dataset_rows: int
    metrics: Mapping[str, float]
    fairness: Mapping[str, float | Sequence[str]]
    additivity_pass_rate: float
    p95_explanation_ms: float
    policy: PromotionPolicy
    model_card: Mapping[str, Any] | None = None
    schema_version: Literal[1] = 1

    def __post_init__(self) -> None:
        for name, value in (
            ("model_artifact_hash", self.model_artifact_hash),
            ("dataset_hash", self.dataset_hash),
        ):
            if len(value) != 64 or any(char not in "0123456789abcdefABCDEF" for char in value):
                raise ValueError(f"{name} must be a SHA-256 hexadecimal digest")
        if self.dataset_rows < 0:
            raise ValueError("dataset_rows cannot be negative")
        if not 0 <= self.additivity_pass_rate <= 1:
            raise ValueError("additivity_pass_rate must be between zero and one")
        if self.p95_explanation_ms < 0:
            raise ValueError("p95_explanation_ms cannot be negative")

    def to_api(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "schemaVersion": self.schema_version,
            "modelArtifactHash": self.model_artifact_hash,
            "datasetHash": self.dataset_hash,
            "codeCommit": self.code_commit,
            "datasetRows": self.dataset_rows,
            "metrics": dict(self.metrics),
            "fairness": {
                key: list(value) if isinstance(value, (list, tuple)) else value
                for key, value in self.fairness.items()
            },
            "explainability": {
                "additivityPassRate": self.additivity_pass_rate,
                "p95ExplanationMs": self.p95_explanation_ms,
            },
            "policy": self.policy.to_api(),
        }
        if self.model_card is not None:
            payload["modelCard"] = dict(self.model_card)
        return payload


@dataclass(frozen=True)
class EmergencyOverride:
    authorized_role: Literal["admin", "ml_governance"]
    reason: str

    def __post_init__(self) -> None:
        if self.authorized_role not in {"admin", "ml_governance"}:
            raise ValueError("authorized_role must be admin or ml_governance")
        if len(self.reason.strip()) < 20:
            raise ValueError("override reason must contain at least 20 characters")

    def to_api(self) -> dict[str, str]:
        return {"authorizedRole": self.authorized_role, "reason": self.reason.strip()}


@dataclass(frozen=True)
class Target:
    operator: ThresholdOperator
    value: float

    def to_api(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class NumericConstraint:
    minimum: float | None = None
    maximum: float | None = None
    step: float = 1.0
    protected: bool = False
    immutable: bool = False
    monotonic: Literal["increase", "decrease", "none"] = "none"
    cost_weight: float = 1.0

    def __post_init__(self) -> None:
        if self.step <= 0:
            raise ValueError("step must be positive")
        if self.minimum is not None and self.maximum is not None and self.minimum > self.maximum:
            raise ValueError("minimum cannot exceed maximum")
        if self.cost_weight <= 0:
            raise ValueError("cost_weight must be positive")

    def to_api(self) -> dict[str, Any]:
        payload = {
            "type": "number",
            "minimum": self.minimum,
            "maximum": self.maximum,
            "step": self.step,
            "protected": self.protected,
            "immutable": self.immutable,
            "monotonic": self.monotonic,
            "costWeight": self.cost_weight,
        }
        return {key: value for key, value in payload.items() if value is not None}


@dataclass(frozen=True)
class CategoricalConstraint:
    allowed_values: Sequence[str | int | float | bool]
    protected: bool = False
    immutable: bool = False
    cost_weight: float = 1.0

    def __post_init__(self) -> None:
        if not self.allowed_values:
            raise ValueError("allowed_values cannot be empty")
        if self.cost_weight <= 0:
            raise ValueError("cost_weight must be positive")

    def to_api(self) -> dict[str, Any]:
        return {
            "type": "category",
            "allowedValues": list(self.allowed_values),
            "protected": self.protected,
            "immutable": self.immutable,
            "costWeight": self.cost_weight,
        }


FeatureConstraint = NumericConstraint | CategoricalConstraint


@dataclass(frozen=True)
class CounterfactualRequest:
    features: Mapping[str, Any]
    target: Target
    constraints: Mapping[str, FeatureConstraint]
    maximum_changed_features: int = 2
    maximum_candidates: int = 3
    timeout_ms: int = 10_000

    def __post_init__(self) -> None:
        if self.maximum_changed_features < 1:
            raise ValueError("maximum_changed_features must be positive")
        if not 1 <= self.maximum_candidates <= 20:
            raise ValueError("maximum_candidates must be between one and twenty")
        if not 1 <= self.timeout_ms <= 120_000:
            raise ValueError("timeout_ms must be between one and 120000")

    def to_api(self) -> dict[str, Any]:
        return {
            "features": dict(self.features),
            "target": self.target.to_api(),
            "constraints": {key: value.to_api() for key, value in self.constraints.items()},
            "maximumChangedFeatures": self.maximum_changed_features,
            "maximumCandidates": self.maximum_candidates,
            "timeoutMs": self.timeout_ms,
        }
