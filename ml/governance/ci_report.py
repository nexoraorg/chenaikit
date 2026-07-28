"""Build CI governance artifacts from training-produced evaluation inputs.

Training must emit ``governance-input.json`` next to the model. Refusing to
invent missing metrics is intentional: absent evidence blocks promotion.
"""
from __future__ import annotations
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
import yaml

from ml.governance.model_card import generate_model_card
from ml.governance.policy import GovernancePolicy, evaluate_policy


def digest(path: Path) -> str:
    value = sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    evidence_files = list(args.models.rglob("governance-input.json"))
    artifacts = [p for p in args.models.rglob("*") if p.is_file() and p.suffix in {".pkl", ".joblib"}]
    dataset_files = [p for p in args.dataset.rglob("*") if p.is_file()] if args.dataset.exists() else []
    if len(evidence_files) != 1 or not artifacts or not dataset_files:
        print("Governance evidence, model artifact, or evaluation dataset is missing; promotion is blocked.", file=sys.stderr)
        return 2
    evidence = json.loads(evidence_files[0].read_text())
    artifact_hash = digest(artifacts[0])
    dataset_manifest = {"files": [{"path": str(p), "sha256": digest(p)} for p in sorted(dataset_files)]}
    dataset_manifest["hash"] = sha256(json.dumps(dataset_manifest, sort_keys=True).encode()).hexdigest()
    policy = GovernancePolicy.model_validate(yaml.safe_load(args.policy.read_text()))
    report = {**evidence["report"], "modelArtifactHash": artifact_hash, "datasetHash": dataset_manifest["hash"]}
    result = evaluate_policy(policy, report)
    final = {**report, **result}
    card = generate_model_card({**evidence["modelCard"], "artifactHash": artifact_hash,
                                "datasetHash": dataset_manifest["hash"]}, final, result)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "evaluation-report.json").write_text(json.dumps(final, indent=2, sort_keys=True))
    (args.output / "dataset-manifest.json").write_text(json.dumps(dataset_manifest, indent=2, sort_keys=True))
    (args.output / "model-card.md").write_text(
        f"# Model card: {card['modelVersion']}\n\n"
        f"Generated: {card['generatedAt']}\n\n"
        f"Policy decision: **{result['decision']}**\n\n"
        f"## Intended uses\n\n" + "\n".join(f"- {x}" for x in card["intendedUses"]) +
        "\n\n## Prohibited uses\n\n" + "\n".join(f"- {x}" for x in card["prohibitedUses"]) +
        f"\n\n## Limitations\n\n{card['limitations']}\n\n{card['notice']}\n"
    )
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
