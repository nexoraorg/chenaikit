"""Data contract definitions and validators for the chenai ML pipeline.

Enforces schema validation and missing-value imputation for FeatureVector
and ModelResult payloads, referencing NUMERIC_FEATURE_SPECS in
packages/chenai-mlflow/src/index.ts as the single source of truth.
"""

from __future__ import annotations

import datetime
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

FEATURE_VECTOR_SCHEMA_VERSION = "1.0.0"
MODEL_RESULT_SCHEMA_VERSION = "1.0.0"
STROOPS_PER_XLM = 10_000_000

SUBJECT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+$")
ISO_UTC_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$")

SUBJECT_KINDS: Set[str] = {"account", "transaction"}
KYC_TIERS: Set[int] = {0, 1, 2, 3}
MODEL_TASKS: Set[str] = {"credit-score", "fraud-detect"}
RISK_LABELS: Set[str] = {"low", "medium", "high"}


class SchemaValidationError(ValueError):
    """Raised when a payload does not satisfy the documented contract."""

    def __init__(self, schema: str, issues: List[str]) -> None:
        super().__init__(f"{schema} validation failed: {'; '.join(issues)}")
        self.schema = schema
        self.issues = issues


@dataclass(frozen=True)
class NumericFeatureSpec:
    """Declarative specification for a single numeric feature."""

    name: str
    unit: str
    integer: bool
    min: float
    max: float
    missing_default: float
    description: str


_CACHED_SPECS: List[NumericFeatureSpec] | None = None


def load_numeric_feature_specs() -> List[NumericFeatureSpec]:
    """Load NUMERIC_FEATURE_SPECS from packages/chenai-mlflow/src/index.ts.

    Parses the TypeScript source directly to guarantee schema consistency
    across language boundaries without manual duplication.
    """
    global _CACHED_SPECS
    if _CACHED_SPECS is not None:
        return _CACHED_SPECS

    current_dir = Path(__file__).resolve().parent
    repo_root = current_dir.parent
    ts_path = repo_root / "packages" / "chenai-mlflow" / "src" / "index.ts"

    if not ts_path.exists():
        fallback_path = repo_root / "packages" / "chenai-mlflow" / "dist" / "index.js"
        if not fallback_path.exists():
            raise FileNotFoundError(
                f"Cannot locate source of truth NUMERIC_FEATURE_SPECS at {ts_path}"
            )
        target_path = fallback_path
    else:
        target_path = ts_path

    content = target_path.read_text(encoding="utf-8")
    block_match = re.search(
        r"export\s+const\s+NUMERIC_FEATURE_SPECS[^=]*=\s*\[(.*?)\]\s*as\s+const;",
        content,
        re.DOTALL,
    )
    if not block_match:
        block_match = re.search(
            r"exports\.NUMERIC_FEATURE_SPECS\s*=\s*\[(.*?)\];",
            content,
            re.DOTALL,
        )

    if not block_match:
        raise ValueError("Failed to extract NUMERIC_FEATURE_SPECS from TypeScript file")

    block = block_match.group(1)
    pattern = re.compile(
        r"\{\s*"
        r"name:\s*\"([^\"]+)\",\s*"
        r"unit:\s*\"([^\"]+)\",\s*"
        r"integer:\s*(true|false),\s*"
        r"min:\s*([0-9_]+(?:\.[0-9]+)?),\s*"
        r"max:\s*([0-9_]+(?:\.[0-9]+)?|Number\.MAX_SAFE_INTEGER),\s*"
        r"missingDefault:\s*([0-9_]+(?:\.[0-9]+)?),\s*"
        r"description:\s*\"([^\"]+)\"",
        re.MULTILINE | re.DOTALL,
    )

    specs: List[NumericFeatureSpec] = []
    for match in pattern.finditer(block):
        name = match.group(1)
        unit = match.group(2)
        integer = match.group(3) == "true"
        raw_max = match.group(5)
        min_str = match.group(4).replace("_", "")
        def_str = match.group(6).replace("_", "")
        desc = match.group(7)

        min_val = float(min_str) if not integer else int(min_str)
        if raw_max == "Number.MAX_SAFE_INTEGER":
            max_val = 9007199254740991
        else:
            max_str = raw_max.replace("_", "")
            max_val = float(max_str) if not integer else int(max_str)
        def_val = float(def_str) if not integer else int(def_str)

        specs.append(
            NumericFeatureSpec(
                name=name,
                unit=unit,
                integer=integer,
                min=min_val,
                max=max_val,
                missing_default=def_val,
                description=desc,
            )
        )

    if not specs:
        raise ValueError("Extracted empty NUMERIC_FEATURE_SPECS from TypeScript file")

    _CACHED_SPECS = specs
    return _CACHED_SPECS


def _check_timestamp(issues: List[str], record: Dict[str, Any], field: str) -> None:
    val = record.get(field)
    if not isinstance(val, str) or not ISO_UTC_PATTERN.match(val):
        issues.append(f'{field} must be an ISO-8601 UTC timestamp ending in "Z"')
        return
    try:
        clean_val = val[:-1]
        datetime.datetime.fromisoformat(clean_val)
    except ValueError:
        issues.append(f"{field} is not a real calendar instant")


def _check_string(
    issues: List[str],
    record: Dict[str, Any],
    field: str,
    pattern: re.Pattern[str],
    expectation: str,
) -> None:
    val = record.get(field)
    if not isinstance(val, str):
        issues.append(f"{field} must be a string")
    elif not pattern.match(val):
        issues.append(f"{field} must {expectation}")


def validate_feature_vector(payload: Any) -> Dict[str, Any]:
    """Validate an untrusted payload against the FeatureVector contract.

    Parameters:
        payload: The input dictionary to validate.

    Returns:
        The validated dictionary.

    Raises:
        SchemaValidationError: If the payload violates contract constraints.
    """
    if not isinstance(payload, dict):
        raise SchemaValidationError(
            "FeatureVector", ["payload must be a plain object"]
        )

    issues: List[str] = []
    specs = load_numeric_feature_specs()
    spec_names = {spec.name for spec in specs}
    known_fields = {
        "schemaVersion",
        "subjectId",
        "subjectKind",
        "observedAt",
        "kycTier",
    } | spec_names

    for key in payload.keys():
        if key not in known_fields:
            issues.append(f'unknown field "{key}"')

    _check_string(
        issues,
        payload,
        "schemaVersion",
        SEMVER_PATTERN,
        'be a semver string such as "1.0.0"',
    )
    schema_ver = payload.get("schemaVersion")
    if (
        isinstance(schema_ver, str)
        and SEMVER_PATTERN.match(schema_ver)
        and schema_ver != FEATURE_VECTOR_SCHEMA_VERSION
    ):
        issues.append(
            f"schemaVersion {schema_ver} is not supported by this build (expected {FEATURE_VECTOR_SCHEMA_VERSION})"
        )

    _check_string(
        issues,
        payload,
        "subjectId",
        SUBJECT_ID_PATTERN,
        "be an opaque pseudonymous id matching [A-Za-z0-9_-]{1,128} and must not carry personal data",
    )

    subj_kind = payload.get("subjectKind")
    if subj_kind not in SUBJECT_KINDS:
        issues.append(
            f'subjectKind must be one of {", ".join(repr(k) for k in sorted(SUBJECT_KINDS))}'
        )

    _check_timestamp(issues, payload, "observedAt")

    kyc_tier = payload.get("kycTier")
    if kyc_tier not in KYC_TIERS:
        issues.append(
            f'kycTier must be one of {", ".join(str(k) for k in sorted(KYC_TIERS))}'
        )

    for spec in specs:
        if spec.name not in payload:
            issues.append(
                f"{spec.name} is required; use an explicit null to signal a missing value"
            )
            continue

        val = payload[spec.name]
        if val is None:
            continue

        if isinstance(val, bool):
            issues.append(
                f"{spec.name} must be a finite number or null (unit: {spec.unit})"
            )
            continue

        if not isinstance(val, (int, float)) or not math.isfinite(val):
            issues.append(
                f"{spec.name} must be a finite number or null (unit: {spec.unit})"
            )
            continue

        if spec.integer and isinstance(val, float) and not val.is_integer():
            issues.append(f"{spec.name} must be an integer (unit: {spec.unit})")
            continue

        if val < spec.min or val > spec.max:
            issues.append(
                f"{spec.name} must be within [{spec.min}, {spec.max}], got {val}"
            )

    if issues:
        raise SchemaValidationError("FeatureVector", issues)

    return payload


def impute_feature_vector(payload: Any) -> Tuple[Dict[str, Any], List[str]]:
    """Apply the documented missing-value policy to a FeatureVector.

    Parameters:
        payload: FeatureVector payload to validate and impute.

    Returns:
        A tuple of (imputed_vector_dict, imputed_field_names_list).

    Raises:
        SchemaValidationError: If payload is not a valid FeatureVector.
    """
    valid_vector = validate_feature_vector(payload)
    specs = load_numeric_feature_specs()

    imputed: Dict[str, Any] = dict(valid_vector)
    imputed_fields: List[str] = []

    for spec in specs:
        if imputed[spec.name] is None:
            imputed[spec.name] = spec.missing_default
            imputed_fields.append(spec.name)

    imputed["imputedFields"] = imputed_fields
    return imputed, imputed_fields


def validate_model_result(payload: Any) -> Dict[str, Any]:
    """Validate a payload against the ModelResult contract.

    Parameters:
        payload: The model result dictionary to validate.

    Returns:
        The validated dictionary.

    Raises:
        SchemaValidationError: If constraints are violated.
    """
    if not isinstance(payload, dict):
        raise SchemaValidationError(
            "ModelResult", ["payload must be a plain object"]
        )

    issues: List[str] = []
    known_fields = {
        "schemaVersion",
        "modelId",
        "modelVersion",
        "featureVectorVersion",
        "task",
        "subjectId",
        "scoredAt",
        "score",
        "label",
        "confidence",
        "imputedFields",
    }

    for key in payload.keys():
        if key not in known_fields:
            issues.append(f'unknown field "{key}"')

    _check_string(
        issues,
        payload,
        "schemaVersion",
        SEMVER_PATTERN,
        'be a semver string such as "1.0.0"',
    )
    schema_ver = payload.get("schemaVersion")
    if (
        isinstance(schema_ver, str)
        and SEMVER_PATTERN.match(schema_ver)
        and schema_ver != MODEL_RESULT_SCHEMA_VERSION
    ):
        issues.append(
            f"schemaVersion {schema_ver} is not supported by this build (expected {MODEL_RESULT_SCHEMA_VERSION})"
        )

    _check_string(
        issues,
        payload,
        "modelId",
        MODEL_ID_PATTERN,
        "match [A-Za-z0-9._-]{1,128}",
    )
    _check_string(
        issues,
        payload,
        "modelVersion",
        SEMVER_PATTERN,
        'be a semver string such as "2.3.1"',
    )
    _check_string(
        issues,
        payload,
        "featureVectorVersion",
        SEMVER_PATTERN,
        'be a semver string such as "1.0.0"',
    )

    task = payload.get("task")
    if task not in MODEL_TASKS:
        issues.append(
            f'task must be one of {", ".join(repr(t) for k, t in enumerate(sorted(MODEL_TASKS)))}'
        )

    _check_string(
        issues,
        payload,
        "subjectId",
        SUBJECT_ID_PATTERN,
        "be an opaque pseudonymous id matching [A-Za-z0-9_-]{1,128} and must not carry personal data",
    )

    _check_timestamp(issues, payload, "scoredAt")

    score = payload.get("score")
    if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score):
        issues.append("score must be a finite number")
    elif score < 0.0 or score > 1.0:
        issues.append(f"score must be within [0, 1], got {score}")

    label = payload.get("label")
    if label not in RISK_LABELS:
        issues.append(
            f'label must be one of {", ".join(repr(l) for l in sorted(RISK_LABELS))}'
        )

    confidence = payload.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not math.isfinite(confidence):
        issues.append("confidence must be a finite number")
    elif confidence < 0.0 or confidence > 1.0:
        issues.append(f"confidence must be within [0, 1], got {confidence}")

    specs = load_numeric_feature_specs()
    spec_names = {spec.name for spec in specs}

    imputed = payload.get("imputedFields")
    if not isinstance(imputed, list):
        issues.append("imputedFields must be an array (empty when nothing was imputed)")
    else:
        for name in imputed:
            if not isinstance(name, str) or name not in spec_names:
                issues.append(
                    f'imputedFields contains "{name}", which is not a known feature name'
                )

    if issues:
        raise SchemaValidationError("ModelResult", issues)

    return payload
