# Example: Credit Score v2.0 vs v1.0 (90/10 rollout)

Demonstrates the full model registry + A/B testing flow from
[issue #254](https://github.com/nexoraorg/chenaikit/issues/254): registering
two model versions, running a 90/10 canary experiment between them, and
reading back statistically-rigorous results.

## Prerequisites

- The backend running locally (`cd backend && pnpm dev`), or any deployed
  ChenAIKit backend reachable via `CHENAIKIT_API_URL`.
- The `chenai-mlflow` SDK installed: `pip install -e packages/chenai-mlflow`.

## Run it

```bash
export CHENAIKIT_API_URL=http://localhost:3000/api/v2
python examples/credit-score-ab-test/run_experiment.py
```

## What it does

1. Registers (or reuses) a `credit-scoring` model.
2. Registers two versions: `1.0.0` (control, already in production) and
   `2.0.0` (treatment, the improved model).
3. Promotes `1.0.0` to production as the baseline.
4. Creates an experiment with a **90/10** traffic split — 90% of traffic
   stays on the proven v1.0 model, 10% is routed to the new v2.0 model,
   limiting exposure to the unproven version while still collecting a
   usable sample.
5. Simulates 5,000 subjects being assigned and converting (approved for
   credit) at slightly different rates for each variant.
6. Prints the statistical results: conversion rates, p-value, confidence
   interval, and whether the experiment has reached the minimum sample size
   needed to make a decision (peek prevention).
7. If v2.0 wins with statistical significance, promotes it to production
   via the same approval-gated `promote_version()` call used in production
   deployments.

This mirrors a gradual rollout pattern (10% -> 50% -> 100%) — rerunning
`create_experiment` with updated `trafficWeight` values lets you widen the
rollout once you're confident in the results.
