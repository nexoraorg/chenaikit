"""Unit tests for FileDropSink, SqliteSink, and StdoutSink."""

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from sinks import FileDropSink, SqliteSink, StdoutSink


class TestSinks(unittest.TestCase):
    """Test suite for output sink persistence."""

    def setUp(self) -> None:
        """Create sample result dictionary."""
        self.sample_result = {
            "schemaVersion": "1.0.0",
            "modelId": "credit-score-gbm",
            "modelVersion": "1.0.0",
            "featureVectorVersion": "1.0.0",
            "task": "credit-score",
            "subjectId": "acc-sink-test-01",
            "scoredAt": "2026-01-15T00:00:01.000Z",
            "score": 0.12,
            "label": "low",
            "confidence": 0.88,
            "imputedFields": [],
        }

    def test_file_drop_sink_jsonl(self) -> None:
        """Verify FileDropSink writes newline-delimited JSON records."""
        with tempfile.TemporaryDirectory() as tmpdir:
            jsonl_path = Path(tmpdir) / "output.jsonl"
            sink = FileDropSink(jsonl_path)
            sink.write(self.sample_result)
            sink.write(self.sample_result)

            lines = jsonl_path.read_text(encoding="utf-8").strip().splitlines()
            self.assertEqual(len(lines), 2)
            parsed = json.loads(lines[0])
            self.assertEqual(parsed["subjectId"], "acc-sink-test-01")

    def test_file_drop_sink_directory(self) -> None:
        """Verify FileDropSink writes atomic individual files when directed at a directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            drop_dir = Path(tmpdir) / "drops"
            sink = FileDropSink(drop_dir)
            sink.write(self.sample_result)

            expected_file = drop_dir / "acc-sink-test-01_credit-score.json"
            self.assertTrue(expected_file.exists())
            with open(expected_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(data["subjectId"], "acc-sink-test-01")

    def test_sqlite_sink_insert_and_query(self) -> None:
        """Verify SqliteSink establishes schema and persists queried rows."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            sink = SqliteSink(db_path)
            sink.write(self.sample_result)

            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT subject_id, task, score, label FROM model_results WHERE subject_id = ?",
                    ("acc-sink-test-01",),
                )
                rows = cursor.fetchall()

            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0][0], "acc-sink-test-01")
            self.assertEqual(rows[0][1], "credit-score")
            self.assertEqual(rows[0][2], 0.12)
            self.assertEqual(rows[0][3], "low")

    def test_stdout_sink(self) -> None:
        """Verify StdoutSink writes without unhandled exceptions."""
        sink = StdoutSink()
        sink.write(self.sample_result)


if __name__ == "__main__":
    unittest.main()
