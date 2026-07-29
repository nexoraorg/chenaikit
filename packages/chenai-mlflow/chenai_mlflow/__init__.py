"""chenai-mlflow: Python SDK for the ChenAIKit ML model registry and A/B testing API."""

from .client import ModelRegistryClient
from .hashing import hash_artifact
from .errors import ChenAIMLflowError, ModelNotFoundError, ConflictError
from .governance import (
    CategoricalConstraint,
    CounterfactualRequest,
    EmergencyOverride,
    EvaluationReport,
    ExplainabilityPolicy,
    NumericConstraint,
    PromotionPolicy,
    Target,
)

__version__ = "0.1.0"

__all__ = [
    "ModelRegistryClient",
    "hash_artifact",
    "ChenAIMLflowError",
    "ModelNotFoundError",
    "ConflictError",
    "CategoricalConstraint",
    "CounterfactualRequest",
    "EmergencyOverride",
    "EvaluationReport",
    "ExplainabilityPolicy",
    "NumericConstraint",
    "PromotionPolicy",
    "Target",
]
