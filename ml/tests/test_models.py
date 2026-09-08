"""Unit tests for CreditScoreModel and FraudDetectModel."""

import tempfile
import unittest
from pathlib import Path
import numpy as np

from models import (
    CreditScoreModel,
    FraudDetectModel,
    compute_artifact_hash,
    vector_to_features,
)


class TestModels(unittest.TestCase):
    """Test suite verifying model training, inference, serialization, and digests."""

    def setUp(self) -> None:
        """Create deterministic dummy training data."""
        np.random.seed(42)
        self.x_train = np.random.rand(50, 10)
        self.y_train = np.random.randint(0, 2, size=50)

    def test_credit_score_model_inference_and_bounds(self) -> None:
        """Verify credit scoring model outputs bounded scores and valid risk labels."""
        model = CreditScoreModel(random_state=42)
        model.fit(self.x_train, self.y_train)

        test_row = list(self.x_train[0])
        score, label, confidence = model.predict_risk(test_row)

        self.assertTrue(0.0 <= score <= 1.0)
        self.assertIn(label, ["low", "medium", "high"])
        self.assertTrue(0.0 <= confidence <= 1.0)

    def test_credit_score_model_persistence(self) -> None:
        """Verify model serialization and 32-byte SHA-256 hash calculation."""
        model = CreditScoreModel(random_state=42)
        model.fit(self.x_train, self.y_train)

        with tempfile.TemporaryDirectory() as tmpdir:
            dest = Path(tmpdir) / "credit_model.joblib"
            artifact_hash = model.save(dest)
            self.assertEqual(len(artifact_hash), 64)

            loaded = CreditScoreModel().load(dest)
            test_row = list(self.x_train[0])
            orig_score, _, _ = model.predict_risk(test_row)
            loaded_score, _, _ = loaded.predict_risk(test_row)
            self.assertEqual(orig_score, loaded_score)

    def test_fraud_detect_model_inference_and_bounds(self) -> None:
        """Verify fraud detection model outputs bounded risk scores."""
        model = FraudDetectModel(random_state=42)
        model.fit(self.x_train)

        test_row = list(self.x_train[0])
        score, label, confidence = model.predict_risk(test_row)

        self.assertTrue(0.0 <= score <= 1.0)
        self.assertIn(label, ["low", "medium", "high"])
        self.assertTrue(0.0 <= confidence <= 1.0)

    def test_vector_to_features_ordering(self) -> None:
        """Verify consistent feature vector translation to numeric array."""
        vector = {
            "accountAgeDays": 100,
            "transactionCount30d": 20,
            "averageBalanceStroops": 5000000,
            "largestTransferStroops": 1000000,
            "distinctCounterparties30d": 3,
            "failedPaymentCount90d": 1,
            "disputeRatio90d": 0.05,
            "crossBorderTransferRatio30d": 0.2,
            "medianSettlementLatencySeconds": 12.0,
            "kycTier": 1,
        }
        features = vector_to_features(vector)
        self.assertEqual(len(features), 10)
        self.assertEqual(features[0], 100.0)
        self.assertEqual(features[-1], 1.0)


if __name__ == "__main__":
    unittest.main()
