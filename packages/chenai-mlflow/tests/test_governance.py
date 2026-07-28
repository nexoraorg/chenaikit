from __future__ import annotations

import pytest

from chenai_mlflow.governance import (
    CategoricalConstraint,
    CounterfactualRequest,
    EmergencyOverride,
    EvaluationReport,
    ExplainabilityPolicy,
    NumericConstraint,
    PromotionPolicy,
    Target,
)


ARTIFACT_HASH = "a" * 64
DATASET_HASH = "b" * 64


def policy() -> PromotionPolicy:
    return PromotionPolicy(
        minimum_dataset_rows=10_000,
        minimum_cohort_size=100,
        required_metrics={"auc": ">=0.80"},
        fairness={
            "demographicParityRatio": ">=0.80",
            "equalOpportunityDifference": "<=0.10",
        },
        explainability=ExplainabilityPolicy(
            additivity_pass_rate=">=0.99",
            max_p95_explanation_ms=250,
        ),
    )


def test_policy_uses_cross_language_field_names() -> None:
    payload = policy().to_api()
    assert payload["schemaVersion"] == 1
    assert payload["minimumDatasetRows"] == 10_000
    assert payload["minimumCohortSize"] == 100
    assert payload["explainability"]["additivityPassRate"] == ">=0.99"
    assert payload["explainability"]["maxP95ExplanationMs"] == 250


def test_evaluation_report_serializes_complete_evidence() -> None:
    report = EvaluationReport(
        model_artifact_hash=ARTIFACT_HASH,
        dataset_hash=DATASET_HASH,
        code_commit="1234567890abcdef",
        dataset_rows=12_000,
        metrics={"auc": 0.91},
        fairness={
            "demographicParityRatio": 0.88,
            "equalOpportunityDifference": 0.04,
            "suppressedCohorts": [],
        },
        additivity_pass_rate=0.999,
        p95_explanation_ms=72.4,
        policy=policy(),
        model_card={"modelVersion": "1.2.0"},
    )
    payload = report.to_api()
    assert payload["modelArtifactHash"] == ARTIFACT_HASH
    assert payload["datasetHash"] == DATASET_HASH
    assert payload["datasetRows"] == 12_000
    assert payload["modelCard"]["modelVersion"] == "1.2.0"
    assert payload["fairness"]["suppressedCohorts"] == []


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("model_artifact_hash", "not-a-hash"),
        ("dataset_hash", "f" * 63),
    ],
)
def test_evaluation_report_rejects_invalid_hashes(field: str, value: str) -> None:
    values = {
        "model_artifact_hash": ARTIFACT_HASH,
        "dataset_hash": DATASET_HASH,
        "code_commit": "1234567",
        "dataset_rows": 10_000,
        "metrics": {"auc": 0.9},
        "fairness": {},
        "additivity_pass_rate": 1.0,
        "p95_explanation_ms": 10.0,
        "policy": policy(),
    }
    values[field] = value
    with pytest.raises(ValueError, match="SHA-256"):
        EvaluationReport(**values)


def test_counterfactual_request_serializes_constraints() -> None:
    request = CounterfactualRequest(
        features={
            "account_age_months": 24,
            "monthly_income": 3000,
            "employment_type": "salaried",
        },
        target=Target(operator=">=", value=0.75),
        constraints={
            "account_age_months": NumericConstraint(
                minimum=24,
                maximum=120,
                step=6,
                monotonic="increase",
            ),
            "monthly_income": NumericConstraint(
                minimum=1000,
                maximum=10000,
                step=250,
            ),
            "employment_type": CategoricalConstraint(
                allowed_values=["salaried", "self_employed"],
                immutable=True,
            ),
        },
        maximum_changed_features=2,
        maximum_candidates=4,
    )
    payload = request.to_api()
    assert payload["target"] == {"operator": ">=", "value": 0.75}
    assert payload["constraints"]["account_age_months"]["monotonic"] == "increase"
    assert payload["constraints"]["employment_type"]["type"] == "category"
    assert payload["constraints"]["employment_type"]["immutable"] is True


def test_invalid_numeric_constraint_is_rejected() -> None:
    with pytest.raises(ValueError, match="minimum cannot exceed maximum"):
        NumericConstraint(minimum=10, maximum=1)
    with pytest.raises(ValueError, match="step must be positive"):
        NumericConstraint(step=0)


def test_emergency_override_requires_specific_role_and_reason() -> None:
    override = EmergencyOverride(
        authorized_role="ml_governance",
        reason="Incident response requires temporary model promotion.",
    )
    assert override.to_api()["authorizedRole"] == "ml_governance"
    with pytest.raises(ValueError, match="at least 20"):
        EmergencyOverride(authorized_role="admin", reason="too short")
