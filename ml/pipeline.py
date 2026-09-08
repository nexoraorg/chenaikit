"""Pipeline runner and CLI entrypoint for scoring accounts.

Supports single-subject live scoring via Horizon and batch scoring from files,
routing validated ModelResults to file-drop, SQLite, or stdout sinks.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from contract import impute_feature_vector, validate_feature_vector
from emitter import ModelResultEmitter
from features import FeatureBuilder
from ingest import HorizonError, StellarHorizonClient
from models import CreditScoreModel, FraudDetectModel
from sinks import BaseSink, FileDropSink, SqliteSink, StdoutSink


class PipelineRunner:
    """Orchestrates ingestion, feature building, model scoring, and result sinking."""

    def __init__(
        self,
        artifacts_dir: Optional[Path] = None,
        sink: Optional[BaseSink] = None,
        horizon_client: Optional[StellarHorizonClient] = None,
    ) -> None:
        """Initialize pipeline models, manifest, sink, and Horizon ingest client."""
        base_dir = artifacts_dir or (Path(__file__).resolve().parent / "artifacts")
        self.artifacts_dir = base_dir
        self.sink = sink or StdoutSink()
        self.horizon_client = horizon_client or StellarHorizonClient()
        self.feature_builder = FeatureBuilder()

        self.credit_model = CreditScoreModel()
        credit_path = base_dir / "credit_score_gbm.joblib"
        if credit_path.exists():
            self.credit_model.load(credit_path)

        self.fraud_model = FraudDetectModel()
        fraud_path = base_dir / "fraud_detect_iforest.joblib"
        if fraud_path.exists():
            self.fraud_model.load(fraud_path)

        manifest_path = base_dir / "manifest.json"
        artifact_hashes: Dict[str, str] = {}
        if manifest_path.exists():
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)
                for mid, mdata in manifest_data.get("models", {}).items():
                    artifact_hashes[mid] = mdata.get("artifact_hash_sha256", "")

        self.emitter = ModelResultEmitter(artifact_hashes=artifact_hashes)

    def score_vector(
        self,
        vector: Dict[str, Any],
        task: str = "all",
    ) -> List[Dict[str, Any]]:
        """Score a single FeatureVector across the specified task(s)."""
        imputed_vector, _ = impute_feature_vector(vector)
        results: List[Dict[str, Any]] = []

        if task in ("credit-score", "all"):
            res = self.emitter.score_and_emit(
                self.credit_model, imputed_vector, "credit-score"
            )
            results.append(res)

        if task in ("fraud-detect", "all"):
            res = self.emitter.score_and_emit(
                self.fraud_model, imputed_vector, "fraud-detect"
            )
            results.append(res)

        self.sink.write(results)
        return results

    def score_account(
        self,
        account_id: str,
        task: str = "all",
        kyc_tier: int = 0,
    ) -> List[Dict[str, Any]]:
        """Fetch account history from Horizon, build FeatureVector, and score."""
        try:
            account_data = self.horizon_client.get_account(account_id)
            operations = self.horizon_client.get_operations(account_id, limit=200)
            payments = self.horizon_client.get_payments(account_id, limit=200)
            transactions = self.horizon_client.get_transactions(account_id, limit=200)
        except HorizonError:
            account_data = None
            operations = None
            payments = None
            transactions = None

        vector = self.feature_builder.build_from_horizon(
            account_id=account_id,
            account_data=account_data,
            operations=operations,
            payments=payments,
            transactions=transactions,
            kyc_tier=kyc_tier,
        )

        return self.score_vector(vector, task=task)

    def score_batch_file(
        self,
        file_path: Path,
        task: str = "all",
    ) -> List[Dict[str, Any]]:
        """Read and score a batch file containing FeatureVectors (JSON or JSONL)."""
        all_results: List[Dict[str, Any]] = []

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip()

        if file_path.suffix == ".jsonl" or ("\n" in content and not content.startswith("[")):
            lines = [line.strip() for line in content.splitlines() if line.strip()]
            for line in lines:
                raw_item = json.loads(line)
                valid_vec = validate_feature_vector(raw_item)
                results = self.score_vector(valid_vec, task=task)
                all_results.extend(results)
        else:
            items = json.loads(content)
            if isinstance(items, dict):
                items = [items]
            for item in items:
                valid_vec = validate_feature_vector(item)
                results = self.score_vector(valid_vec, task=task)
                all_results.extend(results)

        return all_results


def create_sink(sink_type: str, output_path: Optional[str]) -> BaseSink:
    """Instantiate the requested output sink based on CLI configuration."""
    if sink_type == "stdout":
        return StdoutSink()
    if sink_type == "sqlite":
        path = output_path or "ml/output/results.db"
        return SqliteSink(path)
    path = output_path or "ml/output/results.jsonl"
    return FileDropSink(path)


def main() -> None:
    """CLI entrypoint for executing ML scoring pipelines."""
    parser = argparse.ArgumentParser(description="Chenaikit ML Scoring Pipeline")
    parser.add_argument(
        "--mode",
        choices=["single", "batch"],
        default="single",
        help="Execution mode (single account or batch file)",
    )
    parser.add_argument(
        "--subject-id",
        type=str,
        help="Account public key or subject ID for single scoring",
    )
    parser.add_argument(
        "--input-file",
        type=Path,
        help="Input JSON or JSONL file path for batch mode or single vector file",
    )
    parser.add_argument(
        "--task",
        choices=["credit-score", "fraud-detect", "all"],
        default="all",
        help="Scoring task to execute",
    )
    parser.add_argument(
        "--sink",
        choices=["file", "sqlite", "stdout"],
        default="stdout",
        help="Output destination sink",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output file or SQLite path (defaults to ml/output/results.jsonl or results.db)",
    )
    parser.add_argument(
        "--horizon-url",
        type=str,
        default="https://horizon-testnet.stellar.org",
        help="Stellar Horizon endpoint URL",
    )
    parser.add_argument(
        "--kyc-tier",
        type=int,
        choices=[0, 1, 2, 3],
        default=0,
        help="KYC tier for subject",
    )

    args = parser.parse_args()
    sink = create_sink(args.sink, args.output)
    horizon_client = StellarHorizonClient(server_url=args.horizon_url)
    runner = PipelineRunner(sink=sink, horizon_client=horizon_client)

    if args.mode == "single":
        if args.input_file:
            with open(args.input_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            runner.score_vector(data, task=args.task)
        elif args.subject_id:
            runner.score_account(args.subject_id, task=args.task, kyc_tier=args.kyc_tier)
        else:
            parser.error("Single mode requires either --subject-id or --input-file")
    elif args.mode == "batch":
        if not args.input_file:
            parser.error("Batch mode requires --input-file")
        runner.score_batch_file(args.input_file, task=args.task)


if __name__ == "__main__":
    main()
