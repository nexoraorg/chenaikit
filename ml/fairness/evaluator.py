"""Fairness metrics with reproducible bootstrap intervals and small-cell suppression."""
from __future__ import annotations

from typing import Any, Callable
import numpy as np


def _rate(mask: np.ndarray) -> float | None:
    return float(mask.mean()) if mask.size else None


def _ci(values: np.ndarray, fn: Callable[[np.ndarray], float], seed: int, samples: int) -> list[float]:
    rng = np.random.default_rng(seed)
    estimates = [fn(values[rng.integers(0, len(values), len(values))]) for _ in range(samples)]
    return [float(np.quantile(estimates, .025)), float(np.quantile(estimates, .975))]


def _groups(cohort: np.ndarray) -> list[Any]:
    return sorted(set(cohort.tolist()), key=lambda x: str(x))


def evaluate_classification(
    y_true: Any, y_pred: Any, scores: Any, cohort: Any, reference_group: Any,
    minimum_cohort_size: int = 100, seed: int = 42, bootstrap_samples: int = 500,
) -> dict[str, Any]:
    """Evaluate binary outcomes. Protected attributes are evaluation-only inputs."""
    yt, yp, sc, raw = map(np.asarray, (y_true, y_pred, scores, cohort))
    labels = np.asarray(["__missing__" if x is None or str(x).strip() == "" else x for x in raw], dtype=object)
    result: dict[str, Any] = {"referenceGroup": reference_group, "protectedAttributesUsedForPrediction": False, "cohorts": {}}
    for group in _groups(labels):
        idx = labels == group
        n = int(idx.sum())
        if n < minimum_cohort_size:
            result["cohorts"][str(group)] = {"count": n, "suppressed": True, "reason": "minimum_cohort_size"}
            continue
        gyt, gyp, gsc = yt[idx], yp[idx], sc[idx]
        positives, negatives = gyt == 1, gyt == 0
        selection = _rate(gyp == 1)
        tpr = _rate(gyp[positives] == 1)
        fpr = _rate(gyp[negatives] == 1)
        calibration = float(np.mean(np.abs(gsc - gyt)))
        result["cohorts"][str(group)] = {
            "count": n, "suppressed": False, "selectionRate": selection,
            "selectionRateCI": _ci(gyp.astype(float), np.mean, seed, bootstrap_samples),
            "truePositiveRate": tpr, "falsePositiveRate": fpr, "calibrationError": calibration,
        }
    ref = result["cohorts"].get(str(reference_group))
    if not ref or ref.get("suppressed"):
        result["comparisons"] = {"status": "not_computable", "reason": "reference_group_suppressed_or_missing"}
        return result
    comparisons = {}
    for group, metrics in result["cohorts"].items():
        if metrics.get("suppressed"):
            comparisons[group] = {"status": "suppressed"}
            continue
        ref_rate, rate = ref["selectionRate"], metrics["selectionRate"]
        comparisons[group] = {
            "status": "computed",
            "demographicParityDifference": abs(rate - ref_rate),
            "demographicParityRatio": min(rate / ref_rate, ref_rate / rate) if rate and ref_rate else 0.0,
            "equalOpportunityDifference": abs((metrics["truePositiveRate"] or 0) - (ref["truePositiveRate"] or 0)),
            "equalizedOddsDifference": max(
                abs((metrics["truePositiveRate"] or 0) - (ref["truePositiveRate"] or 0)),
                abs((metrics["falsePositiveRate"] or 0) - (ref["falsePositiveRate"] or 0)),
            ),
        }
    result["comparisons"] = comparisons
    return result


def evaluate_regression(
    y_true: Any, y_pred: Any, cohort: Any, reference_group: Any,
    minimum_cohort_size: int = 100, seed: int = 42, bootstrap_samples: int = 500,
) -> dict[str, Any]:
    yt, yp, raw = map(np.asarray, (y_true, y_pred, cohort))
    labels = np.asarray(["__missing__" if x is None or str(x).strip() == "" else x for x in raw], dtype=object)
    result = {"referenceGroup": reference_group, "protectedAttributesUsedForPrediction": False, "cohorts": {}}
    for group in _groups(labels):
        errors = np.abs(yt[labels == group] - yp[labels == group])
        if len(errors) < minimum_cohort_size:
            result["cohorts"][str(group)] = {"count": len(errors), "suppressed": True, "reason": "minimum_cohort_size"}
        else:
            result["cohorts"][str(group)] = {
                "count": len(errors), "suppressed": False, "mae": float(errors.mean()),
                "maeCI": _ci(errors, np.mean, seed, bootstrap_samples),
                "errorQuantiles": {"p50": float(np.quantile(errors, .5)), "p95": float(np.quantile(errors, .95))},
            }
    return result
