"""Unit tests for StellarHorizonClient."""

import unittest
from unittest.mock import MagicMock
import requests

from ingest import HorizonError, StellarHorizonClient


class TestStellarHorizonClient(unittest.TestCase):
    """Test suite verifying Horizon client endpoints and error handling."""

    def setUp(self) -> None:
        """Create mock session for HTTP responses."""
        self.mock_session = MagicMock(spec=requests.Session)
        self.client = StellarHorizonClient(
            server_url="https://horizon-testnet.stellar.org",
            session=self.mock_session,
        )

    def test_get_account_success(self) -> None:
        """Verify successful account retrieval."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"id": "GACC_TEST", "balances": []}
        self.mock_session.get.return_value = mock_resp

        acc = self.client.get_account("GACC_TEST")
        self.assertEqual(acc["id"], "GACC_TEST")

    def test_get_account_not_found(self) -> None:
        """Verify 404 status code raises HorizonError."""
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        self.mock_session.get.return_value = mock_resp

        with self.assertRaises(HorizonError) as ctx:
            self.client.get_account("GACC_MISSING")
        self.assertIn("not found on Horizon", str(ctx.exception))

    def test_get_operations(self) -> None:
        """Verify operations parsing from embedded records."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"_embedded": {"records": [{"id": "op-1"}]}}
        self.mock_session.get.return_value = mock_resp

        ops = self.client.get_operations("GACC_TEST")
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0]["id"], "op-1")

    def test_collect_account_data(self) -> None:
        """Verify complete bundle collection."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "id": "GACC_TEST",
            "balances": [],
            "_embedded": {"records": []},
        }
        self.mock_session.get.return_value = mock_resp

        data = self.client.collect_account_data("GACC_TEST")
        self.assertEqual(data["account_id"], "GACC_TEST")
        self.assertIn("operations", data)
        self.assertIn("payments", data)
        self.assertIn("transactions", data)


if __name__ == "__main__":
    unittest.main()
