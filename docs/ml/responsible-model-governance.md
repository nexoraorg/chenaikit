# Responsible model governance

ChenAIKit treats performance, fairness, explainability, and data quality as
promotion inputs, not as claims of legal compliance. Protected attributes are
accepted only by the offline evaluator and must never be included in production
feature vectors.

## Evaluation contract

An evaluation is bound to the exact model artifact, dataset, policy, and code
commit by SHA-256 hashes. JSON is canonicalized before hashing. Cohort reports
include missing values as `__missing__`; cohorts below `minimumCohortSize` are
suppressed and cause a blocking check rather than silently passing.

Classification reports contain selection rate, demographic-parity difference
and symmetric ratio, TPR, FPR, equal-opportunity difference, equalized-odds
difference, and calibration error. Regression reports contain cohort MAE and
error quantiles. Bootstrap intervals use sampling with replacement and a fixed
seed; intervals quantify sampling uncertainty, not absence of bias.

## Explanations and counterfactuals

The initial portable explanation method is deterministic feature occlusion
against a median background row. The JSON contract includes base value, model
output, ranked contributions, feature display names, units, additivity error,
method, and latency. Redaction is configured separately from internal keys.
TreeSHAP may be selected by deployments that install SHAP, but must emit the
same contract.

Counterfactual search enforces immutable/protected fields, bounds, steps,
monotonic direction, and a changed-feature limit. Every returned candidate is
run through the actual model. Exhausted search returns
`no_feasible_counterfactual`. Counterfactuals are decision-support artifacts,
not financial advice.

## Promotion transaction and overrides

`POST /api/v2/ml-models/versions/:versionId/evaluations` registers a hashed
report. Promotion reads the latest report and changes the production version in
one database transaction. Missing or failed reports return machine-readable
failure reasons. An emergency override requires an `admin` or `ml_governance`
role and a reason of at least 20 characters; it is stored in the immutable
override table. Rollback remains independent of current policy so incidents can
restore an older known-good artifact.

Default thresholds are in `ml/governance/default-policy.yaml`. Thresholds must
be selected by accountable maintainers for the deployment context, reviewed
when data changes, and must not be inferred from synthetic fixtures.
