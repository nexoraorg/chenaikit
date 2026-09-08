"""Output sinks for persisted ModelResult records.

Provides destination sinks for single-subject and batch pipeline execution,
including atomic file drops, direct SQLite persistence, and stdout streaming.
"""

from __future__ import annotations

import abc
import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Union


class BaseSink(abc.ABC):
    """Abstract base class for ModelResult output sinks."""

    @abc.abstractmethod
    def write(self, results: Union[Dict[str, Any], List[Dict[str, Any]]]) -> None:
        """Persist a single ModelResult or a list of ModelResults to the sink."""


class FileDropSink(BaseSink):
    """File drop sink writing newline-delimited JSON or atomic single-record files."""

    def __init__(self, output_path: Union[str, Path]) -> None:
        """Initialize sink with target file or directory path."""
        self.output_path = Path(output_path)

    def write(self, results: Union[Dict[str, Any], List[Dict[str, Any]]]) -> None:
        """Write model results atomically to the destination file or directory."""
        records = [results] if isinstance(results, dict) else results
        if not records:
            return

        if self.output_path.suffix == ".jsonl":
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.output_path, "a", encoding="utf-8") as f:
                for r in records:
                    f.write(json.dumps(r) + "\n")
        elif self.output_path.is_dir() or self.output_path.suffix == "":
            self.output_path.mkdir(parents=True, exist_ok=True)
            for r in records:
                fname = f"{r['subjectId']}_{r['task']}.json"
                target = self.output_path / fname
                temp_fd, temp_path = tempfile.mkstemp(
                    dir=self.output_path, prefix="tmp_drop_", suffix=".json"
                )
                with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                    json.dump(r, f, indent=2)
                os.replace(temp_path, target)
        else:
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            temp_dir = self.output_path.parent
            temp_fd, temp_path = tempfile.mkstemp(
                dir=temp_dir, prefix="tmp_sink_", suffix=self.output_path.suffix
            )
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(records if len(records) > 1 else records[0], f, indent=2)
            os.replace(temp_path, self.output_path)


class SqliteSink(BaseSink):
    """Direct SQLite database sink creating and updating model_results tables."""

    def __init__(self, db_path: Union[str, Path]) -> None:
        """Initialize SQLite sink and ensure target table schema exists."""
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS model_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id TEXT NOT NULL,
                    task TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    score REAL NOT NULL,
                    label TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    scored_at TEXT NOT NULL,
                    imputed_fields TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_subject_task ON model_results(subject_id, task)"
            )
            conn.commit()

    def write(self, results: Union[Dict[str, Any], List[Dict[str, Any]]]) -> None:
        """Insert records into the SQLite model_results table."""
        records = [results] if isinstance(results, dict) else results
        if not records:
            return

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            for r in records:
                cursor.execute(
                    """
                    INSERT INTO model_results (
                        subject_id, task, model_id, model_version,
                        score, label, confidence, scored_at,
                        imputed_fields, payload
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        r["subjectId"],
                        r["task"],
                        r["modelId"],
                        r["modelVersion"],
                        float(r["score"]),
                        r["label"],
                        float(r["confidence"]),
                        r["scoredAt"],
                        json.dumps(r["imputedFields"]),
                        json.dumps(r),
                    ),
                )
            conn.commit()


class StdoutSink(BaseSink):
    """Standard output sink emitting newline-delimited JSON strings."""

    def write(self, results: Union[Dict[str, Any], List[Dict[str, Any]]]) -> None:
        """Stream model result JSON records to stdout."""
        if getattr(sys.stdout, "closed", False):
            return
        records = [results] if isinstance(results, dict) else results
        try:
            for r in records:
                sys.stdout.write(json.dumps(r) + "\n")
            sys.stdout.flush()
        except (BrokenPipeError, OSError, ValueError):
            try:
                sys.stdout.close()
            except Exception:
                pass
