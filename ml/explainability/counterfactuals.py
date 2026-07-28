"""Bounded constrained counterfactual search with model verification."""
from __future__ import annotations
from itertools import combinations, product
from typing import Any, Callable
import numpy as np


def generate_counterfactuals(model: Any, row: dict[str, float], constraints: dict[str, dict[str, Any]],
                             reaches_target: Callable[[float], bool], feature_order: list[str],
                             maximum_changed_features: int = 2, max_candidates: int = 3,
                             classification: bool = False) -> dict[str, Any]:
    def predict(candidate: dict[str, float]) -> float:
        vector = np.asarray([[candidate[k] for k in feature_order]])
        if classification and hasattr(model, "predict_proba"):
            return float(model.predict_proba(vector)[0, 1])
        return float(np.asarray(model.predict(vector)).ravel()[0])
    mutable = [k for k in feature_order if not constraints.get(k, {}).get("immutable", False)
               and not constraints.get(k, {}).get("protected", False)]
    found = []
    for count in range(1, maximum_changed_features + 1):
        for keys in combinations(mutable, count):
            choices = []
            for key in keys:
                cfg = constraints.get(key, {})
                step = cfg.get("step", 1)
                low, high = cfg.get("min", row[key]), cfg.get("max", row[key])
                vals = np.arange(low, high + step / 2, step)
                if cfg.get("monotonic") == "increase":
                    vals = vals[vals >= row[key]]
                elif cfg.get("monotonic") == "decrease":
                    vals = vals[vals <= row[key]]
                choices.append(vals[:100])
            for values in product(*choices):
                candidate = dict(row)
                candidate.update(dict(zip(keys, map(float, values))))
                if all(candidate[k] == row[k] for k in keys):
                    continue
                output = predict(candidate)
                if reaches_target(output):
                    distance = sum(abs(candidate[k] - row[k]) / max(constraints.get(k, {}).get("step", 1), 1e-12) for k in keys)
                    found.append({"features": candidate, "changedFeatures": list(keys), "modelOutput": output,
                                  "verified": True, "cost": float(distance)})
    found.sort(key=lambda x: (x["cost"], x["changedFeatures"]))
    return {"status": "feasible" if found else "no_feasible_counterfactual", "candidates": found[:max_candidates]}
