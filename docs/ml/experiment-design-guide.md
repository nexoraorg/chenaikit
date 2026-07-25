# A/B Experiment Design Guide

This guide covers how to design statistically-valid A/B tests using the
ChenAIKit model registry & experiment framework (`backend/src/services/experimentService.ts`,
`backend/src/utils/abStatistics.ts`).

## 1. Define a single primary metric

Pick one metric (e.g. `approval_rate`, `fraud_catch_rate`) before starting the
experiment. Tracking many metrics and reporting whichever looks significant
after the fact ("p-hacking") inflates the false-positive rate. Secondary
metrics can be recorded as `metric` events but should not drive the
ship/no-ship decision.

## 2. Size the experiment before launch

Use `calculateMinimumSampleSize` (wraps a standard two-proportion power
analysis) to compute how many exposures per variant you need to detect your
minimum detectable effect (MDE) at your chosen significance level and power:

```ts
import { calculateMinimumSampleSize } from '../backend/src/utils/abStatistics';

const plan = calculateMinimumSampleSize(
  /* baselineRate */ 0.12,
  /* minimumDetectableEffect */ 0.10, // 10% relative uplift
  /* alpha */ 0.05,
  /* power */ 0.8
);
// plan.requiredSampleSizePerVariant
```

Set `minimumDetectableEffect` on the experiment (`createExperiment`) so the
dashboard and API can tell you when you've collected enough data.

## 3. Choose a traffic split

- **50/50** for a straightforward two-variant comparison when you want the
  fastest path to significance.
- **90/10** (or similar skewed splits) for higher-risk changes — e.g. rolling
  out a new fraud detection model — where you want to limit exposure while
  still collecting a usable treatment sample. Expect the experiment to run
  longer, since the underpowered arm's sample size still gates readiness.

Traffic weights must sum to 100. Assignment is deterministic and sticky
(hash of experiment key + subject id), so a user stays in the same variant
for the life of the experiment even across app servers.

## 4. Multiple variants -> Bonferroni correction

If you configure more than two variants (one control, several treatments),
set `bonferroniCorrection: true` (this is the default when there are >2
variants). Each treatment-vs-control comparison is tested at
`alpha / numberOfTreatments` instead of the raw significance level, which
controls the family-wise error rate across all the comparisons you're
running simultaneously.

## 5. Peek prevention

Checking significance before you've reached the planned sample size inflates
your false-positive rate — every "peek" is another chance to see a
transient swing and call it real. `getResults()` returns `readyForDecision:
false` until every variant has reached `powerAnalysis.requiredSampleSizePerVariant`
exposures. Treat this as a hard gate: don't ship or kill a variant based on
results collected before `readyForDecision` is `true`.

## 6. Reading the output

For each treatment, `getResults()` returns:

- `conversionRate` — conversions / exposures
- `significance.pValue` / `significance.significant` — two-proportion z-test
  vs. control, using the (possibly Bonferroni-corrected) alpha
- `significance.confidenceInterval` — 95% CI on the difference in
  conversion rate (variant - control)
- `significance.relativeUplift` — `(variantRate - controlRate) / controlRate`

A result is only actionable once `readyForDecision` is `true` **and**
`significance.significant` is `true`.

## 7. Ending an experiment

Call `completeExperiment()` once you've made a decision. If the winning
variant is a new model version, promote it via `ModelRegistryService.promote()`
— see the [deployment runbook](./model-deployment-runbook.md).
