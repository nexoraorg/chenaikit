"""Cross-language contract verification between Python and TypeScript packages."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import subprocess
import unittest

from contract import (
    impute_feature_vector,
    validate_feature_vector,
    validate_model_result,
)
from emitter import ModelResultEmitter
from features import FeatureBuilder
from models import CreditScoreModel


class TestCrossLanguageContract(unittest.TestCase):
    """Test suite verifying contract compliance across Python and TypeScript implementations."""

    @classmethod
    def setUpClass(cls) -> None:
        """Locate harness and verify Node environment."""
        cls.harness_path = Path(__file__).resolve().parent / "node_validator_harness.js"
        cls.assertTrue(cls.harness_path.exists(), "Node validator harness must exist")

    def _call_node_harness(self, command: str, payload: dict) -> dict:
        cmd = ["node", str(self.harness_path), command, json.dumps(payload)]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(proc.stdout)

    def test_python_generated_feature_vector_passes_typescript_validator(self) -> None:
        """Ensure Python FeatureBuilder output is accepted by TypeScript validateFeatureVector."""
        builder = FeatureBuilder(default_kyc_tier=2)
        vector = builder.build_from_horizon(
            account_id="account-cross-01",
            account_data={"balances": [{"asset_type": "native", "balance": "150.25"}]},
            operations=[{"created_at": "2025-01-01T00:00:00Z"}],
            payments=[
                {
                    "created_at": "2026-01-10T00:00:00Z",
                    "from": "account-cross-01",
                    "to": "account-counterparty-02",
                    "amount": "25.0",
                    "asset_type": "native",
                }
            ],
            transactions=[
                {
                    "created_at": "2026-01-10T00:00:00Z",
                    "successful": True,
                    "latency_seconds": 3.8,
                }
            ],
            observed_at="2026-01-15T00:00:00.000Z",
            kyc_tier=2,
        )

        response = self._call_node_harness("validate-feature-vector", vector)
        self.assertTrue(
            response.get("success"),
            f"TypeScript rejected Python feature vector: {response.get('error')} {response.get('issues')}",
        )

    def test_python_gap_feature_vector_imputes_identically_in_typescript(self) -> None:
        """Ensure Python missing-value policy aligns with TypeScript imputeFeatureVector."""
        builder = FeatureBuilder(default_kyc_tier=0)
        gap_vector = builder.build_from_horizon(
            account_id="account-gap-01",
            account_data=None,
            operations=None,
            payments=None,
            transactions=None,
            observed_at="2026-01-15T00:00:00.000Z",
        )

        py_imputed, py_fields = impute_feature_vector(gap_vector)

        response = self._call_node_harness("impute-feature-vector", gap_vector)
        self.assertTrue(response.get("success"), f"TypeScript impute failed: {response.get('error')}")

        ts_result = response["result"]
        self.assertEqual(py_fields, ts_result["imputedFields"])
        self.assertEqual(py_imputed["medianSettlementLatencySeconds"], ts_result["medianSettlementLatencySeconds"])
        self.assertEqual(py_imputed["averageBalanceStroops"], ts_result["averageBalanceStroops"])

    def test_python_generated_model_result_passes_typescript_validator(self) -> None:
        """Ensure Python ModelResultEmitter output is accepted by TypeScript validateModelResult."""
        model = CreditScoreModel(random_state=42)
        import numpy as np

        model.fit(np.random.rand(20, 10), np.random.randint(0, 2, size=20))

        builder = FeatureBuilder(default_kyc_tier=1)
        vector = builder.build_from_horizon(
            account_id="account-scored-01",
            observed_at="2026-01-15T00:00:00.000Z",
        )

        emitter = ModelResultEmitter()
        result = emitter.score_and_emit(
            model=model,
            raw_or_imputed_vector=vector,
            task="credit-score",
            scored_at="2026-01-15T00:00:02.000Z",
        )

        response = self._call_node_harness("validate-model-result", result)
        self.assertTrue(
            response.get("success"),
            f"TypeScript rejected Python model result: {response.get('error')} {response.get('issues')}",
        )

    def test_typescript_examples_pass_python_validators(self) -> None:
        """Ensure TypeScript synthetic example fixtures validate cleanly under Python contracts."""
        cmd = ["node", str(self.harness_path), "export-examples"]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        examples = json.loads(proc.stdout)

        ex_fv = examples["EXAMPLE_FEATURE_VECTOR"]
        valid_fv = validate_feature_vector(ex_fv)
        self.assertEqual(valid_fv["subjectId"], ex_fv["subjectId"])

        ex_gaps = examples["EXAMPLE_FEATURE_VECTOR_WITH_GAPS"]
        valid_gaps = validate_feature_vector(ex_gaps)
        imputed, fields = impute_feature_vector(valid_gaps)
        self.assertEqual(fields, ["accountAgeDays", "averageBalanceStroops", "medianSettlementLatencySeconds"])

        ex_mr = examples["EXAMPLE_MODEL_RESULT"]
        valid_mr = validate_model_result(ex_mr)
        self.assertEqual(valid_mr["modelId"], ex_mr["modelId"])

        ex_mr_imp = examples["EXAMPLE_MODEL_RESULT_WITH_IMPUTATION"]
        valid_mr_imp = validate_model_result(ex_mr_imp)
        self.assertEqual(valid_mr_imp["imputedFields"], ex_mr_imp["imputedFields"])


if __name__ == "__main__":
    unittest.main()
