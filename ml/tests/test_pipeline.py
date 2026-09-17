"""Unit tests for the PipelineRunner coordinator."""

import json
import tempfile
import unittest
from pathlib import Path

from pipeline import PipelineRunner
from sinks import FileDropSink


class TestPipeline(unittest.TestCase):
    """Test suite verifying end-to-end pipeline execution."""

    def setUp(self) -> None:
        """Create sample feature vector payload."""
        self.sample_vector = {
            "schemaVersion": "1.0.0",
            "subjectId": "account-pipe-01",
            "subjectKind": "account",
            "observedAt": "2026-01-15T00:00:00.000Z",
            "kycTier": 1,
            "accountAgeDays": 120,
            "transactionCount30d": 10,
            "averageBalanceStroops": 50000000,
            "largestTransferStroops": 10000000,
            "distinctCounterparties30d": 4,
            "failedPaymentCount90d": 0,
            "disputeRatio90d": 0.0,
            "crossBorderTransferRatio30d": 0.0,
            "medianSettlementLatencySeconds": 5.0,
        }

    def test_score_vector_all_tasks(self) -> None:
        """Verify PipelineRunner scores both tasks and emits valid results."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = Path(tmpdir) / "results.jsonl"
            sink = FileDropSink(output_file)
            runner = PipelineRunner(sink=sink)

            results = runner.score_vector(self.sample_vector, task="all")
            self.assertEqual(len(results), 2)
            tasks = {r["task"] for r in results}
            self.assertEqual(tasks, {"credit-score", "fraud-detect"})

            lines = output_file.read_text(encoding="utf-8").strip().splitlines()
            self.assertEqual(len(lines), 2)

    def test_score_batch_file(self) -> None:
        """Verify PipelineRunner processes batch files accurately."""
        with tempfile.TemporaryDirectory() as tmpdir:
            input_file = Path(tmpdir) / "input.jsonl"
            output_file = Path(tmpdir) / "output.jsonl"

            with open(input_file, "w", encoding="utf-8") as f:
                f.write(json.dumps(self.sample_vector) + "\n")
                vec2 = dict(self.sample_vector, subjectId="account-pipe-02")
                f.write(json.dumps(vec2) + "\n")

            sink = FileDropSink(output_file)
            runner = PipelineRunner(sink=sink)
            results = runner.score_batch_file(input_file, task="credit-score")

            self.assertEqual(len(results), 2)
            for r in results:
                self.assertEqual(r["task"], "credit-score")


if __name__ == "__main__":
    unittest.main()
