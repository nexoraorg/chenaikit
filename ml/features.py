"""Feature builder for translating Horizon data into FeatureVector payloads.

Extracts the nine numeric features defined in the contract from account state,
payments, operations, and transaction logs.
"""

from __future__ import annotations

import datetime
import statistics
from typing import Any, Dict, List, Optional

from contract import (
    FEATURE_VECTOR_SCHEMA_VERSION,
    STROOPS_PER_XLM,
    validate_feature_vector,
)


def _parse_iso_utc(ts_str: str) -> datetime.datetime:
    clean = ts_str.rstrip("Z")
    dt = datetime.datetime.fromisoformat(clean)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt


def _to_iso_utc_string(dt: datetime.datetime) -> str:
    utc_dt = dt.astimezone(datetime.timezone.utc)
    return utc_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


class FeatureBuilder:
    """Transforms raw Stellar Horizon payloads into contract-compliant FeatureVectors."""

    def __init__(self, default_kyc_tier: int = 0) -> None:
        """Initialize the feature builder with a fallback KYC tier."""
        self.default_kyc_tier = default_kyc_tier

    def build_from_horizon(
        self,
        account_id: str,
        account_data: Optional[Dict[str, Any]] = None,
        operations: Optional[List[Dict[str, Any]]] = None,
        payments: Optional[List[Dict[str, Any]]] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
        kyc_tier: Optional[int] = None,
        observed_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Construct a validated FeatureVector from raw Horizon API data."""
        if observed_at is None:
            observed_at_dt = datetime.datetime.now(datetime.timezone.utc)
            observed_at_str = _to_iso_utc_string(observed_at_dt)
        else:
            observed_at_dt = _parse_iso_utc(observed_at)
            observed_at_str = observed_at

        effective_kyc_tier = self.default_kyc_tier if kyc_tier is None else kyc_tier

        account_age_days: Optional[int] = None
        if operations:
            earliest_op_time: Optional[datetime.datetime] = None
            for op in operations:
                created_str = op.get("created_at")
                if created_str:
                    op_dt = _parse_iso_utc(created_str)
                    if earliest_op_time is None or op_dt < earliest_op_time:
                        earliest_op_time = op_dt
            if earliest_op_time is not None and observed_at_dt >= earliest_op_time:
                age_delta = observed_at_dt - earliest_op_time
                account_age_days = max(0, min(36500, int(age_delta.total_seconds() // 86400)))

        cutoff_30d = observed_at_dt - datetime.timedelta(days=30)
        cutoff_90d = observed_at_dt - datetime.timedelta(days=90)

        tx_count_30d: Optional[int] = None
        largest_transfer_stroops: Optional[int] = None
        distinct_counterparties: Optional[int] = None
        cross_border_ratio: Optional[float] = None

        if payments is not None:
            payments_30d = [
                p for p in payments
                if p.get("created_at") and _parse_iso_utc(p["created_at"]) >= cutoff_30d
            ]
            tx_count_30d = min(1_000_000_000, len(payments_30d))

            counterparties = set()
            max_transfer = 0
            cross_border_volume = 0.0
            total_volume = 0.0

            for p in payments_30d:
                from_acc = p.get("from") or p.get("source_account")
                to_acc = p.get("to") or p.get("account")
                if from_acc == account_id and to_acc:
                    counterparties.add(to_acc)
                elif to_acc == account_id and from_acc:
                    counterparties.add(from_acc)

                amount_str = p.get("amount")
                if amount_str:
                    try:
                        amt_xlm = float(amount_str)
                        amt_stroops = int(amt_xlm * STROOPS_PER_XLM)
                        total_volume += amt_xlm
                        if from_acc == account_id:
                            if amt_stroops > max_transfer:
                                max_transfer = amt_stroops
                        if p.get("asset_type") != "native":
                            cross_border_volume += amt_xlm
                    except (ValueError, TypeError):
                        pass

            distinct_counterparties = min(1_000_000_000, len(counterparties))
            largest_transfer_stroops = min(9007199254740991, max_transfer)
            cross_border_ratio = (
                round(cross_border_volume / total_volume, 4)
                if total_volume > 0.0
                else 0.0
            )

        avg_balance_stroops: Optional[int] = None
        if account_data and "balances" in account_data:
            native_balance_xlm = 0.0
            for b in account_data["balances"]:
                if b.get("asset_type") == "native":
                    try:
                        native_balance_xlm = float(b.get("balance", "0"))
                    except (ValueError, TypeError):
                        pass
                    break
            avg_balance_stroops = min(
                9007199254740991,
                max(0, int(native_balance_xlm * STROOPS_PER_XLM))
            )

        failed_payments_90d: Optional[int] = None
        dispute_ratio_90d: Optional[float] = None
        settlement_latencies: List[float] = []

        if transactions is not None:
            txs_90d = [
                tx for tx in transactions
                if tx.get("created_at") and _parse_iso_utc(tx["created_at"]) >= cutoff_90d
            ]
            failed_count = sum(1 for tx in txs_90d if tx.get("successful") is False)
            failed_payments_90d = min(1_000_000_000, failed_count)

            disputed_count = sum(
                1 for tx in txs_90d
                if tx.get("memo", "").lower().startswith("dispute")
                or tx.get("disputed") is True
            )
            dispute_ratio_90d = (
                round(disputed_count / len(txs_90d), 4)
                if len(txs_90d) > 0
                else 0.0
            )

            for tx in txs_90d:
                latency = tx.get("latency_seconds")
                if latency is not None:
                    try:
                        lat_float = float(latency)
                        if 0.0 <= lat_float <= 2592000.0:
                            settlement_latencies.append(lat_float)
                    except (ValueError, TypeError):
                        pass

        median_latency: Optional[float] = None
        if settlement_latencies:
            median_latency = round(statistics.median(settlement_latencies), 3)

        vector: Dict[str, Any] = {
            "schemaVersion": FEATURE_VECTOR_SCHEMA_VERSION,
            "subjectId": account_id,
            "subjectKind": "account",
            "observedAt": observed_at_str,
            "kycTier": effective_kyc_tier,
            "accountAgeDays": account_age_days,
            "transactionCount30d": tx_count_30d,
            "averageBalanceStroops": avg_balance_stroops,
            "largestTransferStroops": largest_transfer_stroops,
            "distinctCounterparties30d": distinct_counterparties,
            "failedPaymentCount90d": failed_payments_90d,
            "disputeRatio90d": dispute_ratio_90d,
            "crossBorderTransferRatio30d": cross_border_ratio,
            "medianSettlementLatencySeconds": median_latency,
        }

        return validate_feature_vector(vector)
