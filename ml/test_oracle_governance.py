"""Tests for oracle network governance features: model hashing and quorum simulation."""

import pytest
import numpy as np
import tempfile
import os
from pathlib import Path

from ml.governance.model_card import compute_model_hash, verify_model_hash, generate_model_card
from ml.governance.policy import evaluate_oracle_readiness, OracleNetworkPolicy, GovernancePolicy
from ml.evaluation.quorum_simulation import (
    QuorumSimulator,
    compare_aggregation_methods,
    simulate_attack_scenario,
    NodeBehavior,
)


class TestModelHashing:
    """Tests for model hashing functionality."""

    def test_compute_model_hash(self):
        """Test basic model hash computation."""
        # Create a temporary file
        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.bin') as f:
            test_data = b"test model data"
            f.write(test_data)
            temp_path = f.name

        try:
            hash_value = compute_model_hash(temp_path)
            assert isinstance(hash_value, str)
            assert len(hash_value) == 64  # SHA256 produces 64 hex characters
            assert hash_value.isalnum()
        finally:
            os.unlink(temp_path)

    def test_compute_model_hash_with_metadata(self):
        """Test model hash computation with metadata."""
        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.bin') as f:
            test_data = b"test model data"
            f.write(test_data)
            temp_path = f.name

        try:
            metadata = {"version": "1.0", "framework": "tensorflow"}
            hash_without_metadata = compute_model_hash(temp_path)
            hash_with_metadata = compute_model_hash(temp_path, metadata)

            assert hash_without_metadata != hash_with_metadata
            assert len(hash_with_metadata) == 64
        finally:
            os.unlink(temp_path)

    def test_verify_model_hash(self):
        """Test model hash verification."""
        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.bin') as f:
            test_data = b"test model data"
            f.write(test_data)
            temp_path = f.name

        try:
            hash_value = compute_model_hash(temp_path)
            assert verify_model_hash(temp_path, hash_value) is True
            assert verify_model_hash(temp_path, "wronghash") is False
        finally:
            os.unlink(temp_path)

    def test_verify_model_hash_with_metadata(self):
        """Test model hash verification with metadata."""
        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.bin') as f:
            test_data = b"test model data"
            f.write(test_data)
            temp_path = f.name

        try:
            metadata = {"version": "1.0"}
            hash_value = compute_model_hash(temp_path, metadata)
            assert verify_model_hash(temp_path, hash_value, metadata) is True
            assert verify_model_hash(temp_path, hash_value, {"version": "2.0"}) is False
        finally:
            os.unlink(temp_path)

    def test_model_card_oracle_network_integration(self):
        """Test model card generation with oracle network fields."""
        metadata = {
            "modelVersion": "1.0.0",
            "artifactHash": "abc123",
            "datasetHash": "def456",
            "codeCommit": "ghi789",
            "intendedUses": ["credit scoring"],
            "prohibitedUses": ["discrimination"],
            "limitations": ["limited to trained domains"],
            "explanationMethod": "SHAP",
            "approvedForOracle": True,
            "oracleMetadata": {"quorum_threshold": 5},
        }

        report = {"metrics": {"accuracy": 0.95}}
        policy_result = {"passed": True}

        card = generate_model_card(metadata, report, policy_result)

        assert "oracleNetwork" in card
        assert card["oracleNetwork"]["modelHash"] == "abc123"
        assert card["oracleNetwork"]["approvedForOracle"] is True


class TestOracleReadinessEvaluation:
    """Tests for oracle readiness evaluation."""

    def test_evaluate_oracle_readiness_all_checks_pass(self):
        """Test oracle readiness when all checks pass."""
        policy = GovernancePolicy(
            schemaVersion=1,
            minimumDatasetRows=10000,
            minimumCohortSize=100,
            requiredMetrics={"accuracy": ">=0.85"},
            fairness={"demographic_parity_diff": "<=0.1"},
        )

        report = {
            "modelHash": "abc123",
            "governanceApproved": True,
            "modelSizeBytes": 500_000_000,
            "metrics": {"accuracy": 0.90},
            "driftDetectionEnabled": True,
        }

        result = evaluate_oracle_readiness(policy, report)
        assert result["readyForOracle"] is True
        assert all(check["passed"] for check in result["checks"])

    def test_evaluate_oracle_readiness_missing_hash(self):
        """Test oracle readiness fails without model hash."""
        policy = GovernancePolicy(
            schemaVersion=1,
            minimumDatasetRows=10000,
            minimumCohortSize=100,
            requiredMetrics={"accuracy": ">=0.85"},
            fairness={"demographic_parity_diff": "<=0.1"},
        )

        report = {
            "governanceApproved": True,
            "modelSizeBytes": 500_000_000,
            "metrics": {"accuracy": 0.90},
            "driftDetectionEnabled": True,
        }

        result = evaluate_oracle_readiness(policy, report)
        assert result["readyForOracle"] is False
        hash_check = next(c for c in result["checks"] if c["name"] == "reproducibleHash")
        assert hash_check["passed"] is False

    def test_evaluate_oracle_readiness_model_too_large(self):
        """Test oracle readiness fails with oversized model."""
        policy = GovernancePolicy(
            schemaVersion=1,
            minimumDatasetRows=10000,
            minimumCohortSize=100,
            requiredMetrics={"accuracy": ">=0.85"},
            fairness={"demographic_parity_diff": "<=0.1"},
            oracleNetwork=OracleNetworkPolicy(maxModelSizeBytes=100_000_000),
        )

        report = {
            "modelHash": "abc123",
            "governanceApproved": True,
            "modelSizeBytes": 500_000_000,
            "metrics": {"accuracy": 0.90},
            "driftDetectionEnabled": True,
        }

        result = evaluate_oracle_readiness(policy, report)
        assert result["readyForOracle"] is False
        size_check = next(c for c in result["checks"] if c["name"] == "modelSize")
        assert size_check["passed"] is False

    def test_evaluate_oracle_readiness_insufficient_accuracy(self):
        """Test oracle readiness fails with insufficient accuracy."""
        policy = GovernancePolicy(
            schemaVersion=1,
            minimumDatasetRows=10000,
            minimumCohortSize=100,
            requiredMetrics={"accuracy": ">=0.85"},
            fairness={"demographic_parity_diff": "<=0.1"},
        )

        report = {
            "modelHash": "abc123",
            "governanceApproved": True,
            "modelSizeBytes": 500_000_000,
            "metrics": {"accuracy": 0.80},
            "driftDetectionEnabled": True,
        }

        result = evaluate_oracle_readiness(policy, report)
        assert result["readyForOracle"] is False
        accuracy_check = next(c for c in result["checks"] if c["name"] == "accuracy")
        assert accuracy_check["passed"] is False


class TestQuorumSimulation:
    """Tests for quorum simulation functionality."""

    def test_quorum_simulator_initialization(self):
        """Test quorum simulator initialization."""
        simulator = QuorumSimulator(num_nodes=10, honest_ratio=0.7)
        assert len(simulator.nodes) == 10
        honest_count = sum(1 for n in simulator.nodes if n.behavior == NodeBehavior.HONEST)
        assert honest_count == 7

    def test_generate_ground_truth(self):
        """Test ground truth generation."""
        simulator = QuorumSimulator(num_nodes=10)
        truth = simulator.generate_ground_truth("test_request")
        assert 0.0 <= truth <= 1.0

    def test_simulate_submissions_honest_nodes(self):
        """Test submission simulation with honest nodes."""
        simulator = QuorumSimulator(num_nodes=5, honest_ratio=1.0)
        ground_truth = 0.5
        submissions = simulator.simulate_submissions(ground_truth, "test_request")

        assert len(submissions) == 5
        values = [s.value for s in submissions]
        # All values should be close to ground truth
        assert all(abs(v - ground_truth) < 0.2 for v in values)

    def test_simulate_submissions_dishonest_nodes(self):
        """Test submission simulation with dishonest nodes."""
        simulator = QuorumSimulator(num_nodes=5, honest_ratio=0.0)
        ground_truth = 0.5
        submissions = simulator.simulate_submissions(ground_truth, "test_request")

        assert len(submissions) == 5
        values = [s.value for s in submissions]
        # Values should be biased away from ground truth
        assert any(abs(v - ground_truth) > 0.1 for v in values)

    def test_aggregate_quorum_median(self):
        """Test quorum aggregation using median."""
        simulator = QuorumSimulator(num_nodes=10, honest_ratio=0.7)
        ground_truth = 0.5
        submissions = simulator.simulate_submissions(ground_truth, "test_request")

        result = simulator.aggregate_quorum(submissions, method="median")
        assert result.num_submissions >= simulator.quorum_threshold
        assert 0.0 <= result.aggregated_value <= 1.0
        assert result.median is not None

    def test_aggregate_quorum_insufficient_submissions(self):
        """Test quorum aggregation with insufficient submissions."""
        simulator = QuorumSimulator(num_nodes=10, quorum_threshold=20)
        ground_truth = 0.5
        submissions = simulator.simulate_submissions(ground_truth, "test_request")

        with pytest.raises(ValueError, match="Insufficient submissions"):
            simulator.aggregate_quorum(submissions)

    def test_aggregate_quorum_dispute_trigger(self):
        """Test dispute triggering on high variance."""
        simulator = QuorumSimulator(num_nodes=10, honest_ratio=0.5, variance_threshold=0.01)
        ground_truth = 0.5
        submissions = simulator.simulate_submissions(ground_truth, "test_request")

        result = simulator.aggregate_quorum(submissions)
        # With 50% honest nodes, variance should be high enough to trigger dispute
        assert result.dispute_triggered is True or result.variance > 0.01

    def test_run_simulation(self):
        """Test running a full simulation."""
        simulator = QuorumSimulator(num_nodes=10, honest_ratio=0.7)
        results = simulator.run_simulation(num_requests=10)

        assert len(results) == 10
        for result in results:
            assert result.num_submissions >= simulator.quorum_threshold
            assert 0.0 <= result.aggregated_value <= 1.0

    def test_calculate_accuracy(self):
        """Test accuracy calculation."""
        simulator = QuorumSimulator(num_nodes=10, honest_ratio=0.7)
        results = simulator.run_simulation(num_requests=10)
        ground_truths = [simulator.generate_ground_truth(f"req_{i}") for i in range(10)]

        mae = simulator.calculate_accuracy(results, ground_truths)
        assert mae >= 0.0
        assert mae <= 1.0  # Maximum possible error

    def test_analyze_disputes(self):
        """Test dispute analysis."""
        simulator = QuorumSimulator(num_nodes=10, honest_ratio=0.5, variance_threshold=0.05)
        results = simulator.run_simulation(num_requests=20)

        stats = simulator.analyze_disputes(results)
        assert "dispute_rate" in stats
        assert "total_disputes" in stats
        assert "total_requests" in stats
        assert 0.0 <= stats["dispute_rate"] <= 1.0


class TestAggregationMethodComparison:
    """Tests for comparing aggregation methods."""

    def test_compare_aggregation_methods(self):
        """Test comparison of different aggregation methods."""
        comparison = compare_aggregation_methods(num_nodes=10, honest_ratio=0.7, num_requests=50)

        assert "median" in comparison
        assert "mean" in comparison
        assert "trimmed_mean" in comparison

        for method, stats in comparison.items():
            assert "mae" in stats
            assert "dispute_rate" in stats
            assert stats["mae"] >= 0.0
            assert 0.0 <= stats["dispute_rate"] <= 1.0

    def test_median_resistant_to_outliers(self):
        """Test that median is more resistant to outliers than mean."""
        comparison = compare_aggregation_methods(num_nodes=10, honest_ratio=0.5, num_requests=50)

        # With 50% honest nodes, median should generally have lower MAE than mean
        # due to resistance to dishonest node outliers
        median_mae = comparison["median"]["mae"]
        mean_mae = comparison["mean"]["mae"]

        # This is a statistical tendency, not a guarantee
        # But median should generally perform better with outliers
        assert median_mae <= mean_mae * 1.5  # Allow some variance


class TestAttackSimulation:
    """Tests for attack scenario simulation."""

    def test_dishonest_majority_attack(self):
        """Test simulation of dishonest majority attack."""
        impact = simulate_attack_scenario("dishonest_majority", num_nodes=10, num_requests=30)

        assert impact["attack_type"] == "dishonest_majority"
        assert "dispute_rate" in impact
        assert "avg_variance" in impact

        # Dishonest majority should cause high dispute rate
        assert impact["dispute_rate"] > 0.5

    def test_no_reveal_attack(self):
        """Test simulation of no-reveal attack."""
        impact = simulate_attack_scenario("no_reveal", num_nodes=10, num_requests=30)

        assert impact["attack_type"] == "no_reveal"
        assert "dispute_rate" in impact

        # High failure rate should cause issues
        assert impact["dispute_rate"] > 0.3

    def test_late_reveal_attack(self):
        """Test simulation of late reveal attack."""
        impact = simulate_attack_scenario("late_reveal", num_nodes=10, num_requests=30)

        assert impact["attack_type"] == "late_reveal"
        assert "dispute_rate" in impact

    def test_invalid_attack_type(self):
        """Test handling of invalid attack type."""
        with pytest.raises(ValueError, match="Unknown attack type"):
            simulate_attack_scenario("invalid_attack", num_nodes=10, num_requests=30)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
