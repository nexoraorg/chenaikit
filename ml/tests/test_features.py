"""Unit tests for FeatureBuilder transformation logic."""

import unittest
from features import FeatureBuilder


class TestFeatureBuilder(unittest.TestCase):
    """Test suite verifying FeatureVector construction from raw Horizon data."""

    def setUp(self) -> None:
        """Initialize FeatureBuilder instance."""
        self.builder = FeatureBuilder(default_kyc_tier=1)

    def test_build_from_complete_horizon_data(self) -> None:
        """Ensure full Horizon history converts into a valid complete FeatureVector."""
        account_data = {
            "balances": [
                {"asset_type": "credit_alphanum4", "balance": "500.0"},
                {"asset_type": "native", "balance": "250.75"},
            ]
        }
        operations = [
            {"created_at": "2025-01-15T00:00:00Z", "type": "create_account"},
            {"created_at": "2025-06-01T00:00:00Z", "type": "payment"},
        ]
        payments = [
            {
                "created_at": "2026-01-10T00:00:00Z",
                "from": "GACC_TARGET",
                "to": "GACC_OTHER1",
                "amount": "50.0",
                "asset_type": "native",
            },
            {
                "created_at": "2026-01-12T00:00:00Z",
                "from": "GACC_OTHER2",
                "to": "GACC_TARGET",
                "amount": "100.0",
                "asset_type": "credit_alphanum4",
            },
        ]
        transactions = [
            {
                "created_at": "2026-01-10T00:00:00Z",
                "successful": True,
                "latency_seconds": 4.2,
            },
            {
                "created_at": "2026-01-11T00:00:00Z",
                "successful": False,
                "latency_seconds": 5.8,
            },
        ]

        vector = self.builder.build_from_horizon(
            account_id="GACC_TARGET",
            account_data=account_data,
            operations=operations,
            payments=payments,
            transactions=transactions,
            observed_at="2026-01-15T00:00:00.000Z",
            kyc_tier=2,
        )

        self.assertEqual(vector["subjectId"], "GACC_TARGET")
        self.assertEqual(vector["kycTier"], 2)
        self.assertEqual(vector["accountAgeDays"], 365)
        self.assertEqual(vector["transactionCount30d"], 2)
        self.assertEqual(vector["averageBalanceStroops"], 2507500000)
        self.assertEqual(vector["largestTransferStroops"], 500000000)
        self.assertEqual(vector["distinctCounterparties30d"], 2)
        self.assertEqual(vector["failedPaymentCount90d"], 1)
        self.assertEqual(vector["medianSettlementLatencySeconds"], 5.0)

    def test_build_with_missing_horizon_signals(self) -> None:
        """Ensure missing signals produce explicit nulls for contract compliance."""
        vector = self.builder.build_from_horizon(
            account_id="GACC_EMPTY",
            account_data=None,
            operations=None,
            payments=None,
            transactions=None,
            observed_at="2026-01-15T00:00:00.000Z",
        )

        self.assertEqual(vector["subjectId"], "GACC_EMPTY")
        self.assertIsNone(vector["accountAgeDays"])
        self.assertIsNone(vector["averageBalanceStroops"])
        self.assertIsNone(vector["transactionCount30d"])
        self.assertIsNone(vector["medianSettlementLatencySeconds"])


if __name__ == "__main__":
    unittest.main()
