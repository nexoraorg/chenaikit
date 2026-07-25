"""Content-addressable hashing helpers for model artifacts."""

import hashlib
from pathlib import Path
from typing import Union


def hash_artifact(artifact_path: Union[str, Path], chunk_size: int = 65536) -> str:
    """Computes the SHA256 hex digest of a model artifact file.

    Used for content-addressable storage: identical `.pkl`/`.joblib` files
    always resolve to the same hash, so the registry can detect duplicate
    uploads and verify artifact integrity on promotion/rollback.
    """
    digest = hashlib.sha256()
    with open(artifact_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()
