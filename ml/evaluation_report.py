"""Evaluation report generation and persistence for the chenaikit ML pipeline.

An evaluation report is a small, versioned, serializable record that travels
with the metrics output so results can be compared or audited later. Reports
identify the model, the dataset, and the evaluation configuration that
produced the metrics.

Design guarantees:

- Deterministic serialization: canonical JSON with recursively sorted keys,
  fixed separators, and ASCII escaping. Two reports built from identical
  inputs serialize to identical bytes.
- Versioned: every report carries ``schema_version``.
- Tamper-evident: ``report_id`` is derived from the SHA-256 digest of the
  canonical report body, so edits invalidate the identifier.
- No training data: metric/parameter values must be JSON scalars. Container
  values and keys that look like raw data are rejected outright instead of
  being silently copied into the report.

This module is stdlib-only on purpose.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Optional, Union

REPORT_SCHEMA_VERSION = "1.0"

REPORT_FILENAME = "evaluation_report.json"
METRICS_FILENAME = "metrics.json"

# Keys are matched case-insensitively. Exact matches keep common aggregate
# stats such as ``n_samples`` usable while still blocking raw-data dumps.
SENSITIVE_KEY_EXACT = frozenset(
    {"records", "rows", "samples", "raw", "data", "training_set", "test_set"}
)
SENSITIVE_KEY_SUBSTRINGS = (
    "raw_data",
    "training_data",
    "train_data",
    "data_records",
    "serialized_data",
)

MAX_STRING_LENGTH = 512


class EvaluationReportError(Exception):
    """Base class for evaluation report failures."""


class MissingMetadataError(EvaluationReportError):
    """Raised when required model/dataset/configuration identifiers are absent."""


class SensitiveDataError(EvaluationReportError):
    """Raised when a value or key looks like it carries training data."""


class ReportIntegrityError(EvaluationReportError):
    """Raised when a report fails schema validation or its digest mismatch."""


Scalar = Optional[Union[str, int, float, bool]]

_REQUIRED_MODEL_FIELDS = ("name", "version")
_REQUIRED_DATASET_FIELDS = ("identifier", "version")
_REQUIRED_EVALUATION_FIELDS = ("config_id",)


def _check_key(path: str, key: str) -> None:
    lowered = key.lower()
    if lowered in SENSITIVE_KEY_EXACT:
        raise SensitiveDataError(
            f"{path}: refusing to store value under sensitive-looking key {key!r}"
        )
    if any(pattern in lowered for pattern in SENSITIVE_KEY_SUBSTRINGS):
        raise SensitiveDataError(
            f"{path}: refusing to store value under sensitive-looking key {key!r}"
        )


def _check_scalar(path: str, value: Any) -> None:
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise EvaluationReportError(
                f"{path}: NaN/Infinity cannot be serialized to JSON"
            )
        return
    if isinstance(value, str):
        if len(value) > MAX_STRING_LENGTH:
            raise SensitiveDataError(
                f"{path}: string values are capped at {MAX_STRING_LENGTH} "
                "characters; bulk payloads do not belong in reports"
            )
        return
    raise SensitiveDataError(
        f"{path}: expected a scalar (str/int/float/bool/None), got "
        f"{type(value).__name__}; containers may carry training data"
    )


def _check_scalars(section: str, mapping: Mapping[str, Any]) -> None:
    for key, value in mapping.items():
        path = f"{section}.{key}"
        _check_key(path, key)
        _check_scalar(path, value)


def _require_fields(section: str, metadata: Mapping[str, Any], fields: tuple) -> None:
    missing = [field for field in fields if not str(metadata.get(field) or "").strip()]
    if missing:
        raise MissingMetadataError(
            f"Missing required {section} metadata field(s): {', '.join(missing)}"
        )


def _canonical_json(payload: Any) -> str:
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        allow_nan=False,
    )


def _content_view(report: Mapping[str, Any]) -> dict:
    return {key: value for key, value in report.items() if key != "report_id"}


def compute_report_digest(report: Mapping[str, Any]) -> str:
    """SHA-256 hex digest of the canonical report body (excluding report_id)."""
    body = json.loads(_canonical_json(_content_view(report)))
    return hashlib.sha256(_canonical_json(body).encode("utf-8")).hexdigest()


def create_evaluation_report(
    model: Mapping[str, Any],
    dataset: Mapping[str, Any],
    evaluation: Mapping[str, Any],
    metrics: Mapping[str, Scalar],
    *,
    generated_at: Optional[str] = None,
    code_version: Optional[str] = None,
) -> dict:
    """Build a validated evaluation report dict.

    ``generated_at`` defaults to the current UTC time; pass an explicit value
    to get fully reproducible output.
    """
    _require_fields("model", model, _REQUIRED_MODEL_FIELDS)
    _require_fields("dataset", dataset, _REQUIRED_DATASET_FIELDS)
    _require_fields("evaluation", evaluation, _REQUIRED_EVALUATION_FIELDS)

    params = dict(evaluation.get("params") or {})
    _check_scalars("metrics", metrics)
    _check_scalars("evaluation.params", params)

    timestamp = generated_at or datetime.now(timezone.utc).isoformat(
        timespec="seconds"
    ).replace("+00:00", "Z")

    report = {
        "schema_version": REPORT_SCHEMA_VERSION,
        "report_id": "",
        "generated_at": timestamp,
        "model": {
            "name": str(model["name"]),
            "version": str(model["version"]),
        },
        "dataset": {
            "identifier": str(dataset["identifier"]),
            "version": str(dataset["version"]),
        },
        "evaluation": {
            "config_id": str(evaluation["config_id"]),
            "params": params,
        },
        "metrics": dict(metrics),
    }
    if code_version is not None:
        report["code_version"] = str(code_version)

    report["report_id"] = "er-" + compute_report_digest(report)[:16]
    validate_report(report)
    return report


def validate_report(report: Mapping[str, Any]) -> None:
    """Validate structure, schema version, scalars, and content digest."""
    if not isinstance(report, Mapping):
        raise ReportIntegrityError("Report must be a JSON object")
    if report.get("schema_version") != REPORT_SCHEMA_VERSION:
        raise ReportIntegrityError(
            f"Unsupported schema_version {report.get('schema_version')!r}, "
            f"expected {REPORT_SCHEMA_VERSION!r}"
        )
    for section, fields in (
        ("model", _REQUIRED_MODEL_FIELDS),
        ("dataset", _REQUIRED_DATASET_FIELDS),
        ("evaluation", _REQUIRED_EVALUATION_FIELDS),
    ):
        block = report.get(section)
        if not isinstance(block, Mapping):
            raise ReportIntegrityError(f"Missing {section!r} section")
        _require_fields(section, block, fields)

    _check_scalars("metrics", report.get("metrics") or {})
    _check_scalars(
        "evaluation.params", (report.get("evaluation") or {}).get("params") or {}
    )

    report_id = report.get("report_id")
    if not isinstance(report_id, str) or not report_id.startswith("er-"):
        raise ReportIntegrityError("Missing or malformed report_id")
    expected = "er-" + compute_report_digest(report)[:16]
    if report_id != expected:
        raise ReportIntegrityError(
            f"report_id {report_id!r} does not match report contents "
            f"(expected {expected!r}); the report was modified after creation"
        )


def serialize_report(report: Mapping[str, Any]) -> str:
    """Canonical, deterministic JSON serialization of a report."""
    return _canonical_json(report)


def persist_report(
    report: Mapping[str, Any],
    directory: Union[str, os.PathLike],
    *,
    metrics: Optional[Mapping[str, Scalar]] = None,
) -> Path:
    """Persist the report (and optionally the metrics payload) to disk.

    Writes are atomic per file: content lands in a temporary file first and is
    then moved into place next to the metrics output.
    """
    validate_report(report)
    out_dir = Path(directory)
    out_dir.mkdir(parents=True, exist_ok=True)

    files = [(REPORT_FILENAME, serialize_report(report))]
    if metrics is not None:
        files.append((METRICS_FILENAME, _canonical_json(metrics)))

    for filename, content in files:
        target = out_dir / filename
        tmp_path = target.with_suffix(target.suffix + ".tmp")
        tmp_path.write_text(content, encoding="utf-8")
        os.replace(tmp_path, target)
    return out_dir / REPORT_FILENAME


def load_report(path: Union[str, os.PathLike]) -> dict:
    """Load and validate a persisted report."""
    raw = Path(path).read_text(encoding="utf-8")
    try:
        report = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ReportIntegrityError(f"Invalid JSON in {path}: {exc}") from exc
    validate_report(report)
    return report
