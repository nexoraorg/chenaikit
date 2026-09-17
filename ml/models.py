"""Predictive models for credit scoring and fraud anomaly detection.

Implements scikit-learn baseline models operating on imputed FeatureVectors,
exporting model weights and calculating SHA-256 artifact digests compatible
with the Soroban model-attestation contract.
"""

from __future__ import annotations

import hashlib
import math
from pathlib import Path
from typing import Any, Dict, List, Tuple
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest

FEATURE_COLUMNS: List[str] = [
    "accountAgeDays",
    "transactionCount30d",
    "averageBalanceStroops",
    "largestTransferStroops",
    "distinctCounterparties30d",
    "failedPaymentCount90d",
    "disputeRatio90d",
    "crossBorderTransferRatio30d",
    "medianSettlementLatencySeconds",
    "kycTier",
]


def vector_to_features(vector: Dict[str, Any]) -> List[float]:
    """Convert an imputed FeatureVector into an ordered numeric feature array."""
    row: List[float] = []
    for col in FEATURE_COLUMNS:
        val = vector.get(col, 0)
        row.append(float(val) if val is not None else 0.0)
    return row


def compute_artifact_hash(filepath: Path) -> str:
    """Compute 32-byte SHA-256 hexadecimal digest of a model artifact."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class CreditScoreModel:
    """Gradient boosting model for credit default risk estimation."""

    MODEL_ID = "credit-score-gbm"
    MODEL_VERSION = "1.0.0"

    def __init__(self, random_state: int = 42) -> None:
        """Initialize the credit score classifier with a deterministic seed."""
        self.random_state = random_state
        self.clf = GradientBoostingClassifier(
            n_estimators=60,
            max_depth=3,
            learning_rate=0.1,
            random_state=random_state,
        )
        self.is_fitted = False

    def fit(self, x_data: np.ndarray, y_labels: np.ndarray) -> "CreditScoreModel":
        """Fit the gradient boosting estimator on training data."""
        self.clf.fit(x_data, y_labels)
        self.is_fitted = True
        return self

    def predict_risk(self, feature_row: List[float]) -> Tuple[float, str, float]:
        """Predict continuous credit risk score, discrete risk label, and confidence."""
        if not self.is_fitted:
            raise RuntimeError("CreditScoreModel is not fitted")

        x_arr = np.array([feature_row], dtype=float)
        probs = self.clf.predict_proba(x_arr)[0]
        risk_score = float(np.clip(probs[1], 0.0, 1.0))
        risk_score = round(risk_score, 4)

        if risk_score < 0.33:
            label = "low"
        elif risk_score < 0.66:
            label = "medium"
        else:
            label = "high"

        confidence = round(float(np.max(probs)), 4)
        return risk_score, label, confidence

    def save(self, destination: Path) -> str:
        """Persist model to disk and return its SHA-256 artifact hash."""
        destination.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.clf, destination)
        return compute_artifact_hash(destination)

    def load(self, source: Path) -> "CreditScoreModel":
        """Load model from disk."""
        self.clf = joblib.load(source)
        self.is_fitted = True
        return self


class FraudDetectModel:
    """Isolation Forest anomaly detection model for payment and account fraud."""

    MODEL_ID = "fraud-detect-iforest"
    MODEL_VERSION = "1.0.0"

    def __init__(self, random_state: int = 42) -> None:
        """Initialize the isolation forest detector with a deterministic seed."""
        self.random_state = random_state
        self.detector = IsolationForest(
            n_estimators=60,
            contamination=0.1,
            random_state=random_state,
        )
        self.is_fitted = False

    def fit(self, x_data: np.ndarray) -> "FraudDetectModel":
        """Fit the isolation forest on training data."""
        self.detector.fit(x_data)
        self.is_fitted = True
        return self

    def predict_risk(self, feature_row: List[float]) -> Tuple[float, str, float]:
        """Predict continuous anomaly risk score, risk label, and confidence."""
        if not self.is_fitted:
            raise RuntimeError("FraudDetectModel is not fitted")

        x_arr = np.array([feature_row], dtype=float)
        decision = float(self.detector.decision_function(x_arr)[0])
        risk_score = 1.0 / (1.0 + math.exp(decision * 6.0))
        risk_score = round(float(np.clip(risk_score, 0.0, 1.0)), 4)

        if risk_score < 0.33:
            label = "low"
        elif risk_score < 0.66:
            label = "medium"
        else:
            label = "high"

        confidence = round(float(np.clip(abs(risk_score - 0.5) * 2.0, 0.0, 1.0)), 4)
        return risk_score, label, confidence

    def save(self, destination: Path) -> str:
        """Persist model to disk and return its SHA-256 artifact hash."""
        destination.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.detector, destination)
        return compute_artifact_hash(destination)

    def load(self, source: Path) -> "FraudDetectModel":
        """Load model from disk."""
        self.detector = joblib.load(source)
        self.is_fitted = True
        return self
