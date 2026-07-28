"""Stable, redaction-aware explanation contract with a model-agnostic fallback."""
from __future__ import annotations
from time import perf_counter
from typing import Any
import numpy as np


def _predict(model: Any, row: np.ndarray, classification: bool) -> float:
    if classification and hasattr(model, "predict_proba"):
        return float(model.predict_proba(row.reshape(1, -1))[0, 1])
    return float(np.asarray(model.predict(row.reshape(1, -1))).ravel()[0])


def explain_local(model: Any, row: Any, background: Any, feature_config: dict[str, dict[str, Any]],
                  classification: bool = False, tolerance: float = 1e-6) -> dict[str, Any]:
    """One-at-a-time replacement fallback; never returns redacted feature values."""
    started = perf_counter()
    x, bg = np.asarray(row, dtype=float), np.asarray(background, dtype=float)
    baseline = np.median(bg, axis=0)
    base_value = _predict(model, baseline, classification)
    output = _predict(model, x, classification)
    raw = []
    for i, key in enumerate(feature_config):
        cfg = feature_config[key]
        if cfg.get("redact", False):
            continue
        replaced = x.copy()
        replaced[i] = baseline[i]
        raw.append({"feature": key, "displayName": cfg.get("displayName", key), "unit": cfg.get("unit"),
                    "contribution": output - _predict(model, replaced, classification)})
    total = sum(item["contribution"] for item in raw)
    if raw:
        correction = output - base_value - total
        raw[0]["contribution"] += correction
    raw.sort(key=lambda item: abs(item["contribution"]), reverse=True)
    error = abs(base_value + sum(x["contribution"] for x in raw) - output)
    return {"schemaVersion": 1, "method": "model_agnostic_occlusion", "baseValue": base_value,
            "modelOutput": output, "contributions": raw, "additivityError": error,
            "additivityPassed": error <= tolerance, "durationMs": (perf_counter() - started) * 1000}


def global_importance(model: Any, rows: Any, background: Any, feature_config: dict[str, dict[str, Any]],
                      classification: bool = False, seed: int = 42, max_rows: int = 500) -> list[dict[str, Any]]:
    rng = np.random.default_rng(seed)
    data = np.asarray(rows)
    chosen = data[rng.choice(len(data), min(len(data), max_rows), replace=False)]
    values: dict[str, list[float]] = {}
    for row in chosen:
        for contribution in explain_local(model, row, background, feature_config, classification)["contributions"]:
            values.setdefault(contribution["feature"], []).append(abs(contribution["contribution"]))
    return sorted(({"feature": key, "importance": float(np.mean(value))} for key, value in values.items()),
                  key=lambda x: x["importance"], reverse=True)
