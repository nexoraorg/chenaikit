class ChenAIMLflowError(Exception):
    """Base error for all chenai-mlflow SDK failures."""


class ModelNotFoundError(ChenAIMLflowError):
    """Raised when a model or model version cannot be found."""


class ConflictError(ChenAIMLflowError):
    """Raised when attempting to register a model/version that already exists."""


class ValidationError(ChenAIMLflowError):
    """Raised when the API rejects a request due to invalid input."""
