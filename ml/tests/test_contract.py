"""Unit tests for contract loading, validation, and imputation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from contract import (
    FEATURE_VECTOR_SCHEMA_VERSION,
    MODEL_RESULT_SCHEMA_VERSION,
    SchemaValidationError,
    impute_feature_vector,
    load_numeric_feature_specs,
    validate_feature_vector,
    validate_model_result,
)


class TestContractValidation(unittest.TestCase):
    """Test suite for contract schema rules and missing-value imputation."""

    def setUp(self) -> None:
        """Create valid baseline payloads for tests."""
        self.valid_feature_vector = {
            "schemaVersion": FEATURE_VECTOR_SCHEMA_VERSION,
            "subjectId": "account-valid-001",
            "subjectKind": "account",
            "observedAt": "2026-01-15T00:00:00.000Z",
            "kycTier": 2,
            "accountAgeDays": 100,
            "transactionCount30d": 15,
            "averageBalanceStroops": 500000000,
            "largestTransferStroops": 100000000,
            "distinctCounterparties30d": 5,
            "failedPaymentCount90d": 0,
            "disputeRatio90d": 0.0,
            "crossBorderTransferRatio30d": 0.1,
            "medianSettlementLatencySeconds": 4.5,
        }

        self.valid_model_result = {
            "schemaVersion": MODEL_RESULT_SCHEMA_VERSION,
            "modelId": "credit-score-gbm",
            "modelVersion": "1.0.0",
            "featureVectorVersion": "1.0.0",
            "task": "credit-score",
            "subjectId": "account-valid-001",
            "scoredAt": "2026-01-15T00:00:01.000Z",
            "score": 0.25,
            "label": "low",
            "confidence": 0.85,
            "imputedFields": [],
        }

    def test_load_numeric_feature_specs(self) -> None:
        """Ensure specs are extracted accurately from TypeScript source."""
        specs = load_numeric_feature_specs()
        self.assertEqual(len(specs), 9)
        names = [s.name for s in specs]
        self.assertIn("accountAgeDays", names)
        self.assertIn("medianSettlementLatencySeconds", names)

        latency_spec = next(s for s in specs if s.name == "medianSettlementLatencySeconds")
        self.assertEqual(latency_spec.missing_default, 86400.0)

    def test_validate_valid_feature_vector(self) -> None:
        """Validate a well-formed feature vector successfully."""
        result = validate_feature_vector(self.valid_feature_vector)
        self.assertEqual(result["subjectId"], "account-valid-001")

    def test_reject_unknown_field(self) -> None:
        """Ensure unapproved fields are rejected."""
        payload = dict(self.valid_feature_vector)
        payload["unauthorizedField"] = "bad"
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_feature_vector(payload)
        self.assertIn("unknown field", str(ctx.exception))

    def test_reject_unsupported_schema_version(self) -> None:
        """Ensure unsupported schema version is rejected."""
        payload = dict(self.valid_feature_vector)
        payload["schemaVersion"] = "2.0.0"
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_feature_vector(payload)
        self.assertIn("schemaVersion 2.0.0 is not supported", str(ctx.exception))

    def test_reject_personal_data_in_subject_id(self) -> None:
        """Ensure subjectId containing PII symbols is rejected."""
        payload = dict(self.valid_feature_vector)
        payload["subjectId"] = "ada.lovelace@example.com"
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_feature_vector(payload)
        self.assertIn("must not carry personal data", str(ctx.exception))

    def test_reject_missing_numeric_field(self) -> None:
        """Ensure omission of a numeric field is rejected (explicit null required)."""
        payload = dict(self.valid_feature_vector)
        del payload["averageBalanceStroops"]
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_feature_vector(payload)
        self.assertIn("averageBalanceStroops is required", str(ctx.exception))

    def test_reject_out_of_bounds_numeric_field(self) -> None:
        """Ensure values outside defined boundaries are rejected."""
        payload = dict(self.valid_feature_vector)
        payload["disputeRatio90d"] = 1.5
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_feature_vector(payload)
        self.assertIn("disputeRatio90d must be within", str(ctx.exception))

    def test_reject_fractional_integer_field(self) -> None:
        """Ensure integer fields reject float fractions."""
        payload = dict(self.valid_feature_vector)
        payload["accountAgeDays"] = 12.5
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_feature_vector(payload)
        self.assertIn("accountAgeDays must be an integer", str(ctx.exception))

    def test_impute_feature_vector(self) -> None:
        """Ensure null values impute to their documented defaults."""
        payload = dict(self.valid_feature_vector)
        payload["accountAgeDays"] = None
        payload["medianSettlementLatencySeconds"] = None

        imputed, fields = impute_feature_vector(payload)
        self.assertEqual(imputed["accountAgeDays"], 0)
        self.assertEqual(imputed["medianSettlementLatencySeconds"], 86400.0)
        self.assertEqual(set(fields), {"accountAgeDays", "medianSettlementLatencySeconds"})
        self.assertEqual(imputed["imputedFields"], fields)

    def test_validate_valid_model_result(self) -> None:
        """Validate a well-formed ModelResult successfully."""
        result = validate_model_result(self.valid_model_result)
        self.assertEqual(result["label"], "low")

    def test_reject_invalid_model_result_label(self) -> None:
        """Ensure non-standard risk labels are rejected."""
        payload = dict(self.valid_model_result)
        payload["label"] = "critical"
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_model_result(payload)
        self.assertIn("label must be one of", str(ctx.exception))

    def test_reject_invalid_model_result_score_range(self) -> None:
        """Ensure scores outside [0, 1] are rejected."""
        payload = dict(self.valid_model_result)
        payload["score"] = 1.2
        with self.assertRaises(SchemaValidationError) as ctx:
            validate_model_result(payload)
        self.assertIn("score must be within [0, 1]", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
