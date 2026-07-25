#!/usr/bin/env python3
"""Example: credit score model v2.0 vs v1.0 with a 90/10 traffic split.

Registers two model versions, runs a 90/10 canary experiment between them,
simulates traffic, and reports statistically-rigorous results using the
chenai-mlflow SDK against a running ChenAIKit backend.
"""

import hashlib
import random
import sys
import time

from chenai_mlflow import ModelRegistryClient
from chenai_mlflow.errors import ChenAIMLflowError

# Simulated "true" conversion (approval) rates for the demo. In a real
# rollout these come from actual user outcomes, not a coin flip.
V1_TRUE_APPROVAL_RATE = 0.62
V2_TRUE_APPROVAL_RATE = 0.68  # v2.0 is the improved model
SIMULATED_SUBJECTS = 5000


def fake_artifact_path(version: str) -> str:
    # In a real pipeline this is the path to a trained .pkl/.joblib file
    # produced by ml/training/train_credit_score.py. For this example we
    # just need a stable string to hash for content addressing.
    return f"ml/models/credit_scoring_{version}.joblib"


def main() -> int:
    client = ModelRegistryClient()  # reads CHENAIKIT_API_URL from env

    print(f"Using backend: {client.base_url}")

    try:
        model = client.get_or_create_model("credit-scoring", task_type="credit_scoring")
        print(f"Model: {model['name']} ({model['id']})")

        v1 = client.register_version(
            model_id=model["id"],
            version="1.0.0",
            artifact_path=fake_artifact_path("v1"),
            accuracy=0.87,
            auc=0.90,
        )
        print(f"Registered v1.0.0 ({v1['id']}), stage={v1['stage']}")

        v2 = client.register_version(
            model_id=model["id"],
            version="2.0.0",
            artifact_path=fake_artifact_path("v2"),
            accuracy=0.91,
            auc=0.94,
        )
        print(f"Registered v2.0.0 ({v2['id']}), stage={v2['stage']}")

        client.promote_version(v1["id"], approved_by="example-script")
        print("Promoted v1.0.0 to production as the baseline")

        experiment = client.create_experiment(
            key=f"credit-score-v2-rollout-{int(time.time())}",
            name="Credit score v2.0 vs v1.0 (90/10 canary)",
            model_id=model["id"],
            metric="approval_rate",
            hypothesis="v2.0 improves approval rate without increasing default risk",
            minimum_detectable_effect=0.05,
            variants=[
                {"name": "control-v1", "modelVersionId": v1["id"], "trafficWeight": 90, "isControl": True},
                {"name": "treatment-v2", "modelVersionId": v2["id"], "trafficWeight": 10},
            ],
        )
        print(f"Created experiment {experiment['key']} ({experiment['id']})")

        client.start_experiment(experiment["id"])
        print(f"Simulating {SIMULATED_SUBJECTS} subjects...")

        for i in range(SIMULATED_SUBJECTS):
            subject_id = f"applicant-{i}"
            variant = client.assign_variant(experiment["id"], subject_id)

            # Deterministic pseudo-random outcome per subject so re-running
            # this script is reproducible.
            seed = int(hashlib.sha256(subject_id.encode()).hexdigest()[:8], 16)
            rng = random.Random(seed)

            true_rate = V2_TRUE_APPROVAL_RATE if variant["name"] == "treatment-v2" else V1_TRUE_APPROVAL_RATE
            if rng.random() < true_rate:
                client.track_conversion(experiment["id"], subject_id)

        results = client.get_results(experiment["id"])
        print_results(results)

        treatment = results["treatments"][0]
        if results["readyForDecision"] and treatment.get("significance", {}).get("significant"):
            print("\nv2.0 wins with statistical significance — promoting to production.")
            client.promote_version(v2["id"], approved_by="example-script")
            client.complete_experiment(experiment["id"])
        else:
            print("\nNot ready to decide yet (or v2.0 did not win) — leaving v1.0 in production.")

        return 0

    except ChenAIMLflowError as err:
        print(f"Error talking to the registry API: {err}", file=sys.stderr)
        print("Is the backend running? See examples/credit-score-ab-test/README.md", file=sys.stderr)
        return 1


def print_results(results: dict) -> None:
    control = results["control"]
    print("\n--- Results ---")
    print(f"Control ({control['variant']['name']}): {control['conversionRate']:.2%} "
          f"({control['conversions']}/{control['exposures']})")

    for treatment in results["treatments"]:
        print(f"Treatment ({treatment['variant']['name']}): {treatment['conversionRate']:.2%} "
              f"({treatment['conversions']}/{treatment['exposures']})")

        sig = treatment.get("significance")
        if sig:
            print(f"  p-value: {sig['pValue']:.4f} (alpha={sig['alpha']:.4f})")
            print(f"  relative uplift: {sig['relativeUplift']:.2%}")
            ci = sig["confidenceInterval"]
            print(f"  95% CI on diff: [{ci['lower']:.2%}, {ci['upper']:.2%}]")
            print(f"  significant: {sig['significant']}")

    power = results.get("powerAnalysis")
    if power:
        print(f"\nRequired sample size per variant: {power['requiredSampleSizePerVariant']}")
    print(f"Ready for decision (peek prevention passed): {results['readyForDecision']}")


if __name__ == "__main__":
    raise SystemExit(main())
