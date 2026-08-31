"""Tests for ml/evaluation_report.py.

Run from the repo root with:

    python3 -m unittest discover -s ml/tests -v
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from evaluation_report import (  # noqa: E402
    METRICS_FILENAME,
    REPORT_FILENAME,
    REPORT_SCHEMA_VERSION,
    EvaluationReportError,
    MissingMetadataError,
    ReportIntegrityError,
    SensitiveDataError,
    compute_report_digest,
    create_evaluation_report,
    load_report,
    persist_report,
    serialize_report,
    validate_report,
)

MODEL = {"name": "credit-score", "version": "1.2.0"}
DATASET = {"identifier": "chena-loans-2024", "version": "3"}
EVALUATION = {
    "config_id": "eval-2024-06-config",
    "params": {"threshold": 0.5, "cv_folds": 5, "shuffle": True},
}
METRICS = {"accuracy": 0.91, "f1": 0.89, "notes": None}
FIXED_TIME = "2026-01-15T10:00:00Z"


def build_report(**overrides):
    kwargs = dict(
        model=MODEL,
        dataset=DATASET,
        evaluation=EVALUATION,
        metrics=METRICS,
        generated_at=FIXED_TIME,
        code_version="abc1234",
    )
    kwargs.update(overrides)
    return create_evaluation_report(**kwargs)


class DeterministicSerializationTest(unittest.TestCase):
    def test_identical_inputs_produce_identical_bytes(self):
        first = serialize_report(build_report())
        second = serialize_report(build_report())
        self.assertEqual(first, second)
        # report_id is content-derived, so identical inputs get identical ids.
        self.assertEqual(build_report()["report_id"], build_report()["report_id"])

    def test_serialization_is_canonical_json(self):
        serialized = serialize_report(build_report())
        parsed = json.loads(serialized)
        # Canonical form: sorted keys, no whitespace.
        self.assertEqual(serialized, json.dumps(parsed, sort_keys=True, separators=(",", ":")))
        self.assertIn('"schema_version":"%s"' % REPORT_SCHEMA_VERSION, serialized)

    def test_input_key_order_does_not_change_output(self):
        reordered = build_report(
            model={"version": MODEL["version"], "name": MODEL["name"]},
            dataset={"version": DATASET["version"], "identifier": DATASET["identifier"]},
            metrics={"notes": None, "f1": 0.89, "accuracy": 0.91},
            evaluation={"params": EVALUATION["params"], "config_id": EVALUATION["config_id"]},
        )
        self.assertEqual(serialize_report(reordered), serialize_report(build_report()))


class RequiredMetadataTest(unittest.TestCase):
    def test_reports_identify_model_dataset_and_config(self):
        report = build_report()
        self.assertEqual(report["model"], {"name": "credit-score", "version": "1.2.0"})
        self.assertEqual(report["dataset"]["identifier"], "chena-loans-2024")
        self.assertEqual(report["evaluation"]["config_id"], "eval-2024-06-config")
        self.assertEqual(report["schema_version"], REPORT_SCHEMA_VERSION)

    def test_missing_model_name_fails(self):
        with self.assertRaises(MissingMetadataError):
            build_report(model={"version": "1.0"})

    def test_missing_model_version_fails(self):
        with self.assertRaises(MissingMetadataError):
            build_report(model={"name": "credit-score"})

    def test_missing_dataset_identifier_fails(self):
        with self.assertRaises(MissingMetadataError):
            build_report(dataset={"version": "3"})

    def test_missing_evaluation_config_id_fails(self):
        with self.assertRaises(MissingMetadataError) as ctx:
            build_report(evaluation={"params": {}})
        self.assertIn("config_id", str(ctx.exception))

    def test_blank_identifier_values_fail(self):
        with self.assertRaises(MissingMetadataError):
            build_report(dataset={"identifier": "   ", "version": "3"})


class SensitiveDataTest(unittest.TestCase):
    def test_container_metric_value_is_rejected(self):
        with self.assertRaises(SensitiveDataError):
            build_report(metrics={"training_records": [1, 2, 3]})

    def test_raw_data_key_is_rejected(self):
        with self.assertRaises(SensitiveDataError):
            build_report(metrics={"raw_data": "should not be here"})

    def test_exact_sensitive_keys_are_rejected_but_aggregates_allowed(self):
        for key in ("records", "rows", "samples", "data"):
            with self.assertRaises(SensitiveDataError):
                build_report(metrics={key: 1})
        # Aggregate counts are fine.
        build_report(metrics={"n_samples": 1000, "num_rows_seen": 1000})

    def test_oversized_string_is_rejected(self):
        with self.assertRaises(SensitiveDataError):
            build_report(metrics={"dump": "x" * 600})

    def test_non_finite_floats_are_rejected(self):
        with self.assertRaises(EvaluationReportError):
            build_report(metrics={"score": float("nan")})


class PersistenceTest(unittest.TestCase):
    def test_persist_and_load_round_trip(self):
        report = build_report()
        with tempfile.TemporaryDirectory() as tmp:
            path = persist_report(report, tmp, metrics=METRICS)
            self.assertEqual(path.name, REPORT_FILENAME)
            self.assertTrue((Path(tmp) / METRICS_FILENAME).exists())
            loaded = load_report(path)
        self.assertEqual(loaded, report)

    def test_tampered_report_fails_validation(self):
        report = build_report()
        tampered = dict(report)
        tampered["metrics"] = dict(report["metrics"], accuracy=0.99)
        with self.assertRaises(ReportIntegrityError):
            validate_report(tampered)
        digest_changed = (
            compute_report_digest(report) != compute_report_digest(tampered)
        )
        self.assertTrue(digest_changed)

    def test_unsupported_schema_version_fails(self):
        report = build_report()
        bogus = json.loads(json.dumps(report))
        bogus["schema_version"] = "999"
        with self.assertRaises(ReportIntegrityError):
            validate_report(bogus)


if __name__ == "__main__":
    unittest.main()
