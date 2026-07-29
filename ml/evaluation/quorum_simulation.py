"""Quorum simulation harness for oracle network evaluation.

This module provides tools to simulate oracle network behavior under various
conditions including honest/dishonest node distributions, variance in submissions,
and dispute resolution scenarios.
"""

from __future__ import annotations
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class NodeBehavior(Enum):
    """Oracle node behavior types."""
    HONEST = "honest"
    DISHONEST = "dishonest"
    MALICIOUS = "malicious"
    UNRELIABLE = "unreliable"


@dataclass
class OracleNode:
    """Represents an oracle node in the simulation."""
    node_id: str
    behavior: NodeBehavior
    reputation: float
    stake: float
    accuracy: float  # True accuracy for honest nodes
    bias: float = 0.0  # Bias for dishonest nodes
    failure_rate: float = 0.0  # Failure rate for unreliable nodes


@dataclass
class Submission:
    """Represents a submission from an oracle node."""
    node_id: str
    value: float
    model_hash: str
    timestamp: int


@dataclass
class QuorumResult:
    """Result of a quorum aggregation."""
    aggregated_value: float
    variance: float
    standard_deviation: float
    num_submissions: int
    num_honest: int
    num_dishonest: int
    trimmed_mean: Optional[float] = None
    median: Optional[float] = None
    dispute_triggered: bool = False


class QuorumSimulator:
    """Simulates oracle network quorum aggregation and dispute scenarios."""

    def __init__(
        self,
        num_nodes: int = 10,
        honest_ratio: float = 0.7,
        quorum_threshold: int = 5,
        variance_threshold: float = 0.15,
    ):
        """
        Initialize the quorum simulator.

        Args:
            num_nodes: Total number of oracle nodes
            honest_ratio: Ratio of honest nodes (0.0 to 1.0)
            quorum_threshold: Minimum submissions required for quorum
            variance_threshold: Variance threshold to trigger disputes
        """
        self.num_nodes = num_nodes
        self.honest_ratio = honest_ratio
        self.quorum_threshold = quorum_threshold
        self.variance_threshold = variance_threshold
        self.nodes: List[OracleNode] = []
        self._initialize_nodes()

    def _initialize_nodes(self) -> None:
        """Initialize oracle nodes with specified behavior distribution."""
        num_honest = int(self.num_nodes * self.honest_ratio)
        num_dishonest = self.num_nodes - num_honest

        for i in range(num_honest):
            self.nodes.append(
                OracleNode(
                    node_id=f"node_{i}",
                    behavior=NodeBehavior.HONEST,
                    reputation=1000.0,
                    stake=1000.0,
                    accuracy=np.random.normal(0.95, 0.02),
                )
            )

        for i in range(num_dishonest):
            behavior = np.random.choice(
                [NodeBehavior.DISHONEST, NodeBehavior.MALICIOUS, NodeBehavior.UNRELIABLE],
                p=[0.5, 0.3, 0.2],
            )
            self.nodes.append(
                OracleNode(
                    node_id=f"node_{num_honest + i}",
                    behavior=behavior,
                    reputation=800.0,
                    stake=1000.0,
                    accuracy=0.5,  # Not used for dishonest nodes
                    bias=np.random.uniform(-0.5, 0.5),
                    failure_rate=0.3 if behavior == NodeBehavior.UNRELIABLE else 0.0,
                )
            )

    def generate_ground_truth(self, request_id: str) -> float:
        """Generate a ground truth value for a request."""
        return np.random.uniform(0.0, 1.0)

    def simulate_submissions(
        self, ground_truth: float, request_id: str
    ) -> List[Submission]:
        """
        Simulate submissions from all nodes for a given ground truth.

        Args:
            ground_truth: The true value to be submitted
            request_id: Identifier for the inference request

        Returns:
            List of submissions from all nodes
        """
        submissions = []
        for node in self.nodes:
            if node.behavior == NodeBehavior.HONEST:
                # Honest nodes submit values close to ground truth
                noise = np.random.normal(0, 0.05)
                value = ground_truth + noise
                value = np.clip(value, 0.0, 1.0)
            elif node.behavior == NodeBehavior.DISHONEST:
                # Dishonest nodes submit biased values
                noise = np.random.normal(0, 0.1)
                value = ground_truth + node.bias + noise
                value = np.clip(value, 0.0, 1.0)
            elif node.behavior == NodeBehavior.MALICIOUS:
                # Malicious nodes submit extreme values
                value = np.random.choice([0.0, 1.0])
            else:  # UNRELIABLE
                # Unreliable nodes may fail to submit
                if np.random.random() < node.failure_rate:
                    continue
                value = ground_truth + np.random.normal(0, 0.15)
                value = np.clip(value, 0.0, 1.0)

            submissions.append(
                Submission(
                    node_id=node.node_id,
                    value=value,
                    model_hash=f"model_{request_id}",
                    timestamp=0,
                )
            )

        return submissions

    def aggregate_quorum(
        self, submissions: List[Submission], method: str = "median"
    ) -> QuorumResult:
        """
        Aggregate submissions using specified method.

        Args:
            submissions: List of submissions to aggregate
            method: Aggregation method ('median', 'mean', 'trimmed_mean')

        Returns:
            QuorumResult with aggregated value and statistics
        """
        if len(submissions) < self.quorum_threshold:
            raise ValueError(f"Insufficient submissions: {len(submissions)} < {self.quorum_threshold}")

        values = [s.value for s in submissions]
        values_array = np.array(values)

        # Calculate statistics
        variance = np.var(values_array)
        std_dev = np.std(values_array)
        median = np.median(values_array)

        # Count honest vs dishonest submissions
        honest_count = sum(
            1 for s in submissions
            if next(n for n in self.nodes if n.node_id == s.node_id).behavior == NodeBehavior.HONEST
        )
        dishonest_count = len(submissions) - honest_count

        # Calculate aggregated value
        if method == "median":
            aggregated = float(median)
        elif method == "mean":
            aggregated = float(np.mean(values_array))
        elif method == "trimmed_mean":
            # Trim 10% from each end
            trim_count = max(1, int(len(values) * 0.1))
            sorted_values = sorted(values)
            trimmed = sorted_values[trim_count:-trim_count]
            aggregated = float(np.mean(trimmed))
        else:
            raise ValueError(f"Unknown aggregation method: {method}")

        # Check if dispute should be triggered
        dispute_triggered = variance > self.variance_threshold

        return QuorumResult(
            aggregated_value=aggregated,
            variance=float(variance),
            standard_deviation=float(std_dev),
            num_submissions=len(submissions),
            num_honest=honest_count,
            num_dishonest=dishonest_count,
            trimmed_mean=float(np.mean(sorted(values)[1:-1])) if len(values) > 2 else None,
            median=float(median),
            dispute_triggered=dispute_triggered,
        )

    def run_simulation(
        self, num_requests: int = 100, method: str = "median"
    ) -> List[QuorumResult]:
        """
        Run a full simulation with multiple requests.

        Args:
            num_requests: Number of inference requests to simulate
            method: Aggregation method to use

        Returns:
            List of quorum results for each request
        """
        results = []
        for i in range(num_requests):
            ground_truth = self.generate_ground_truth(f"request_{i}")
            submissions = self.simulate_submissions(ground_truth, f"request_{i}")
            result = self.aggregate_quorum(submissions, method)
            results.append(result)

        return results

    def calculate_accuracy(self, results: List[QuorumResult], ground_truths: List[float]) -> float:
        """
        Calculate the accuracy of aggregated results compared to ground truth.

        Args:
            results: List of quorum results
            ground_truths: List of ground truth values

        Returns:
            Mean absolute error
        """
        errors = []
        for result, truth in zip(results, ground_truths):
            error = abs(result.aggregated_value - truth)
            errors.append(error)

        return float(np.mean(errors))

    def analyze_disputes(self, results: List[QuorumResult]) -> Dict[str, float]:
        """
        Analyze dispute patterns in simulation results.

        Args:
            results: List of quorum results

        Returns:
            Dictionary with dispute statistics
        """
        total = len(results)
        disputes = sum(1 for r in results if r.dispute_triggered)

        return {
            "dispute_rate": disputes / total if total > 0 else 0.0,
            "total_disputes": float(disputes),
            "total_requests": float(total),
            "avg_variance": float(np.mean([r.variance for r in results])),
            "avg_std_dev": float(np.mean([r.standard_deviation for r in results])),
        }


def compare_aggregation_methods(
    num_nodes: int = 10,
    honest_ratio: float = 0.7,
    num_requests: int = 100,
) -> Dict[str, Dict[str, float]]:
    """
    Compare different aggregation methods.

    Args:
        num_nodes: Number of oracle nodes
        honest_ratio: Ratio of honest nodes
        num_requests: Number of simulation requests

    Returns:
        Dictionary comparing method performance
    """
    methods = ["median", "mean", "trimmed_mean"]
    comparison = {}

    for method in methods:
        simulator = QuorumSimulator(
            num_nodes=num_nodes,
            honest_ratio=honest_ratio,
        )
        results = simulator.run_simulation(num_requests, method)

        # Generate ground truths for accuracy calculation
        ground_truths = [simulator.generate_ground_truth(f"request_{i}") for i in range(num_requests)]

        accuracy = simulator.calculate_accuracy(results, ground_truths)
        dispute_stats = simulator.analyze_disputes(results)

        comparison[method] = {
            "mae": accuracy,
            "dispute_rate": dispute_stats["dispute_rate"],
            "avg_variance": dispute_stats["avg_variance"],
        }

    return comparison


def simulate_attack_scenario(
    attack_type: str,
    num_nodes: int = 10,
    num_requests: int = 50,
) -> Dict[str, float]:
    """
    Simulate specific attack scenarios.

    Args:
        attack_type: Type of attack ('dishonest_majority', 'no_reveal', 'late_reveal')
        num_nodes: Number of oracle nodes
        num_requests: Number of simulation requests

    Returns:
        Dictionary with attack impact metrics
    """
    if attack_type == "dishonest_majority":
        # Simulate dishonest majority (60% dishonest)
        simulator = QuorumSimulator(num_nodes=num_nodes, honest_ratio=0.4)
    elif attack_type == "no_reveal":
        # Simulate high failure rate (unreliable nodes)
        simulator = QuorumSimulator(num_nodes=num_nodes, honest_ratio=0.5)
        for node in simulator.nodes:
            if node.behavior == NodeBehavior.UNRELIABLE:
                node.failure_rate = 0.8
    elif attack_type == "late_reveal":
        # This would be simulated with timing, but for now we use high variance
        simulator = QuorumSimulator(num_nodes=num_nodes, honest_ratio=0.6)
    else:
        raise ValueError(f"Unknown attack type: {attack_type}")

    results = simulator.run_simulation(num_requests)
    dispute_stats = simulator.analyze_disputes(results)

    return {
        "attack_type": attack_type,
        "dispute_rate": dispute_stats["dispute_rate"],
        "avg_variance": dispute_stats["avg_variance"],
        "avg_std_dev": dispute_stats["avg_std_dev"],
    }


if __name__ == "__main__":
    # Run example simulation
    print("Running quorum simulation...")

    # Compare aggregation methods
    comparison = compare_aggregation_methods(num_nodes=10, honest_ratio=0.7, num_requests=100)
    print("\nAggregation Method Comparison:")
    for method, stats in comparison.items():
        print(f"{method}: MAE={stats['mae']:.4f}, Dispute Rate={stats['dispute_rate']:.2%}")

    # Simulate attack scenarios
    attacks = ["dishonest_majority", "no_reveal", "late_reveal"]
    print("\nAttack Scenario Simulation:")
    for attack in attacks:
        impact = simulate_attack_scenario(attack, num_nodes=10, num_requests=50)
        print(f"{attack}: Dispute Rate={impact['dispute_rate']:.2%}, Avg Variance={impact['avg_variance']:.4f}")
