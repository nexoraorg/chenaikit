import numpy as np
from sklearn.linear_model import LinearRegression

from ml.fairness import evaluate_classification, evaluate_regression
from ml.explainability import explain_local, generate_counterfactuals
from ml.governance.policy import GovernancePolicy, evaluate_policy


def test_missing_and_small_cohorts_are_explicit_and_suppressed():
    result = evaluate_classification(
        [0, 1, 0, 1, 1], [0, 1, 0, 1, 0], [.1, .8, .2, .9, .4],
        ["A", "A", None, None, "B"], "A", minimum_cohort_size=2, bootstrap_samples=20,
    )
    assert result["cohorts"]["B"]["suppressed"]
    assert result["cohorts"]["__missing__"]["count"] == 2
    assert result["protectedAttributesUsedForPrediction"] is False


def test_bootstrap_is_deterministic():
    args = ([0, 1] * 50, [0, 1] * 50, ["A"] * 100, "A")
    assert evaluate_regression(*args, seed=7, bootstrap_samples=30) == evaluate_regression(*args, seed=7, bootstrap_samples=30)


def test_explanation_adds_up_and_redacts():
    x = np.array([[0., 0.], [1., 1.], [2., 2.]])
    model = LinearRegression().fit(x, np.array([0., 3., 6.]))
    explanation = explain_local(model, [2., 2.], x, {
        "income": {"displayName": "Income", "unit": "GBP"},
        "secret": {"redact": True},
    })
    assert explanation["additivityPassed"]
    assert [x["feature"] for x in explanation["contributions"]] == ["income"]


def test_counterfactual_never_changes_protected_and_handles_impossible():
    model = LinearRegression().fit([[0, 0], [10, 1]], [0, 10])
    row = {"amount": 0., "protected": 0.}
    constraints = {"amount": {"min": 0, "max": 10, "step": 5}, "protected": {"protected": True}}
    result = generate_counterfactuals(model, row, constraints, lambda y: y >= 5, ["amount", "protected"])
    assert result["candidates"][0]["features"]["protected"] == 0
    impossible = generate_counterfactuals(model, row, constraints, lambda y: y > 100, ["amount", "protected"])
    assert impossible["status"] == "no_feasible_counterfactual"


def test_policy_blocks_biased_report():
    policy = GovernancePolicy(requiredMetrics={"auc": ">=0.8"}, fairness={"demographicParityRatio": ">=0.8"})
    report = {"datasetRows": 10000, "metrics": {"auc": .9},
              "fairness": {"demographicParityRatio": .5, "suppressedCohorts": []},
              "explainability": {"additivityPassRate": 1, "p95ExplanationMs": 20}}
    result = evaluate_policy(policy, report)
    assert not result["passed"]
    assert any(x["name"] == "fairness.demographicParityRatio" and not x["passed"] for x in result["checks"])
