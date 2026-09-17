"""Reproducible training script for credit scoring and fraud detection models.

Trains baseline models with a deterministic random seed, persists model artifacts,
computes 32-byte SHA-256 artifact hashes for Soroban model-attestation compatibility,
and emits signed evaluation reports via evaluation_report.py.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from contract import impute_feature_vector
from evaluation_report import create_evaluation_report, persist_report
from models import CreditScoreModel, FraudDetectModel, vector_to_features


def load_training_data(dataset_path: Path) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]]]:
    """Load and prepare training feature vectors and binary targets."""
    with open(dataset_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    x_list: List[List[float]] = []
    y_list: List[int] = []
    cleaned_vectors: List[Dict[str, Any]] = []

    for item in records:
        target = item.get("_target_label", 0)
        clean_item = {k: v for k, v in item.items() if not k.startswith("_")}
        imputed_vec, _ = impute_feature_vector(clean_item)
        features = vector_to_features(imputed_vec)
        x_list.append(features)
        y_list.append(int(target))
        cleaned_vectors.append(imputed_vec)

    return np.array(x_list, dtype=float), np.array(y_list, dtype=int), cleaned_vectors


def train_models(
    dataset_path: Path,
    output_dir: Path,
    random_state: int = 42,
) -> Dict[str, Any]:
    """Train credit scoring and fraud detection models and persist artifacts."""
    output_dir.mkdir(parents=True, exist_ok=True)
    x_data, y_labels, _ = load_training_data(dataset_path)

    x_train, x_test, y_train, y_test = train_test_split(
        x_data, y_labels, test_size=0.25, random_state=random_state, stratify=y_labels
    )

    credit_model = CreditScoreModel(random_state=random_state)
    credit_model.fit(x_train, y_train)
    credit_dest = output_dir / "credit_score_gbm.joblib"
    credit_hash = credit_model.save(credit_dest)

    test_probs = [credit_model.predict_risk(row)[0] for row in x_test]
    test_preds = [1 if p >= 0.5 else 0 for p in test_probs]

    acc = round(float(accuracy_score(y_test, test_preds)), 4)
    prec = round(float(precision_score(y_test, test_preds, zero_division=0)), 4)
    rec = round(float(recall_score(y_test, test_preds, zero_division=0)), 4)
    f1 = round(float(f1_score(y_test, test_preds, zero_division=0)), 4)
    roc = round(float(roc_auc_score(y_test, test_probs)), 4)

    credit_report = create_evaluation_report(
        model={"name": credit_model.MODEL_ID, "version": credit_model.MODEL_VERSION},
        dataset={"identifier": "sample_dataset.json", "version": "1.0.0"},
        evaluation={"config_id": "eval-stratified-split", "params": {"test_size": 0.25, "seed": random_state}},
        metrics={"accuracy": acc, "precision": prec, "recall": rec, "f1_score": f1, "roc_auc": roc},
        code_version="1.0.0",
    )
    persist_report(
        credit_report,
        output_dir / "credit_score_report",
        metrics={"accuracy": acc, "precision": prec, "recall": rec, "f1_score": f1, "roc_auc": roc},
    )

    fraud_model = FraudDetectModel(random_state=random_state)
    fraud_model.fit(x_train)
    fraud_dest = output_dir / "fraud_detect_iforest.joblib"
    fraud_hash = fraud_model.save(fraud_dest)

    fraud_scores = [fraud_model.predict_risk(row)[0] for row in x_test]
    anomaly_rate = round(float(np.mean([1 if s >= 0.5 else 0 for s in fraud_scores])), 4)
    mean_score = round(float(np.mean(fraud_scores)), 4)

    fraud_report = create_evaluation_report(
        model={"name": fraud_model.MODEL_ID, "version": fraud_model.MODEL_VERSION},
        dataset={"identifier": "sample_dataset.json", "version": "1.0.0"},
        evaluation={"config_id": "eval-isolation-forest", "params": {"contamination": 0.1, "seed": random_state}},
        metrics={"anomaly_rate": anomaly_rate, "mean_risk_score": mean_score},
        code_version="1.0.0",
    )
    persist_report(
        fraud_report,
        output_dir / "fraud_detect_report",
        metrics={"anomaly_rate": anomaly_rate, "mean_risk_score": mean_score},
    )

    manifest = {
        "models": {
            credit_model.MODEL_ID: {
                "version": credit_model.MODEL_VERSION,
                "artifact": str(credit_dest.name),
                "artifact_hash_sha256": credit_hash,
                "report_id": credit_report["report_id"],
                "attestation_bytes32": credit_hash,
            },
            fraud_model.MODEL_ID: {
                "version": fraud_model.MODEL_VERSION,
                "artifact": str(fraud_dest.name),
                "artifact_hash_sha256": fraud_hash,
                "report_id": fraud_report["report_id"],
                "attestation_bytes32": fraud_hash,
            },
        },
        "random_state": random_state,
        "dataset": str(dataset_path.name),
    }

    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest


def main() -> None:
    """CLI entrypoint for model training."""
    parser = argparse.ArgumentParser(description="Train chenaikit credit scoring and fraud detection models")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "sample_dataset.json",
        help="Path to training dataset JSON",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "artifacts",
        help="Output directory for serialized artifacts and evaluation reports",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random state seed for reproducibility",
    )
    args = parser.parse_args()

    manifest = train_models(args.dataset, args.output_dir, random_state=args.seed)
    print("Training complete. Artifact manifest:")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
