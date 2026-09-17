"""Stellar Horizon ingestion client.

Fetches account balances, operation logs, payments, and transaction history
from a Stellar Horizon server to construct raw signals for the FeatureVector builder.
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
import requests


class HorizonError(RuntimeError):
    """Raised when an interaction with the Stellar Horizon API fails."""


class StellarHorizonClient:
    """Client for pulling account history, operations, and balances from Horizon."""

    def __init__(
        self,
        server_url: str = "https://horizon-testnet.stellar.org",
        timeout: float = 10.0,
        session: Optional[requests.Session] = None,
    ) -> None:
        """Initialize the client with server URL and timeout settings."""
        self.server_url = server_url.rstrip("/")
        self.timeout = timeout
        self.session = session or requests.Session()

    def get_account(self, account_id: str) -> Dict[str, Any]:
        """Fetch current account record including native and asset balances."""
        url = f"{self.server_url}/accounts/{account_id}"
        try:
            resp = self.session.get(url, timeout=self.timeout)
            if resp.status_code == 404:
                raise HorizonError(f"Account {account_id} not found on Horizon")
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            raise HorizonError(f"Horizon account query failed for {account_id}: {exc}") from exc

    def get_operations(
        self, account_id: str, limit: int = 200, order: str = "desc"
    ) -> List[Dict[str, Any]]:
        """Fetch account operation history."""
        url = f"{self.server_url}/accounts/{account_id}/operations"
        params = {"limit": limit, "order": order}
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            records = resp.json().get("_embedded", {}).get("records", [])
            return records
        except requests.RequestException as exc:
            raise HorizonError(f"Horizon operations query failed for {account_id}: {exc}") from exc

    def get_payments(
        self, account_id: str, limit: int = 200, order: str = "desc"
    ) -> List[Dict[str, Any]]:
        """Fetch account payment records."""
        url = f"{self.server_url}/accounts/{account_id}/payments"
        params = {"limit": limit, "order": order}
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            records = resp.json().get("_embedded", {}).get("records", [])
            return records
        except requests.RequestException as exc:
            raise HorizonError(f"Horizon payments query failed for {account_id}: {exc}") from exc

    def get_transactions(
        self, account_id: str, limit: int = 200, order: str = "desc"
    ) -> List[Dict[str, Any]]:
        """Fetch account transactions including failed or reverted transactions."""
        url = f"{self.server_url}/accounts/{account_id}/transactions"
        params = {"limit": limit, "order": order}
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            records = resp.json().get("_embedded", {}).get("records", [])
            return records
        except requests.RequestException as exc:
            raise HorizonError(f"Horizon transactions query failed for {account_id}: {exc}") from exc

    def collect_account_data(self, account_id: str) -> Dict[str, Any]:
        """Collect account snapshot, operations, payments, and transactions."""
        now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        account = self.get_account(account_id)
        operations = self.get_operations(account_id, limit=200, order="asc")
        payments = self.get_payments(account_id, limit=200, order="desc")
        transactions = self.get_transactions(account_id, limit=200, order="desc")

        return {
            "account_id": account_id,
            "account": account,
            "operations": operations,
            "payments": payments,
            "transactions": transactions,
            "fetched_at": now,
        }
