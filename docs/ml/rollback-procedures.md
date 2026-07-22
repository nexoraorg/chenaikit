# Model Rollback Procedures

## Manual rollback

Use this when you've identified a problem with the current production model
version (via monitoring, an A/B test result, or a support escalation) and
want to restore a previous version immediately.

### Via API

```
POST /api/v2/ml-models/:modelId/rollback
{
  "targetVersionId": "<id of the version to restore>",
  "actor": "<your name or id>"
}
```

### Via the SDK

```python
client.rollback(model_id, target_version_id, actor="jane.doe")
```

### Via the dashboard

The `ExperimentDashboard` frontend component (`frontend/src/components/ExperimentDashboard.tsx`)
has a "Rollback model" button on each experiment's detail view. It prompts
for the target version id and an actor identifier, then calls the same
rollback endpoint.

### What happens

`ModelRegistryService.rollback()`:
1. Verifies the target version belongs to the specified model.
2. Archives whatever version is currently `production` (sets `stage:
   'archived'`, `archivedAt: now`).
3. Restores the target version to `production` (stamps `promotedAt`,
   `approvedBy: actor`, `approvedAt: now`).

Rollback does **not** require the same approval gate as a forward promotion —
being able to act quickly during an incident matters more than requiring a
second approver, since rollback is itself the safety mechanism.

## Automated canary rollback

`ModelDriftDetector.recordCheck()` runs this automatically whenever a drift
check shows degradation beyond the experiment/model's canary threshold
(default 5% AUC drop, configurable via `canaryThresholdPct`):

1. Finds the most recently archived version for the same model (i.e. the
   version that was in production immediately before the current one).
2. Calls the same `ModelRegistryService.rollback()` path, with
   `actor: 'model-drift-detector'` (or a custom `autoRollbackActor`).
3. Marks the drift check record's `alertSent: true`.

If no archived version exists (e.g. this is the model's first production
version), auto-rollback is skipped and an error is logged — there is nothing
safe to roll back to, so this needs human intervention.

## After a rollback

1. Check `GET /api/v2/ml-models/:modelId/versions/production` to confirm the
   expected version is now serving.
2. Review `GET /api/v2/ml-models/versions/:versionId/drift-checks` for the
   history that triggered the rollback (if automated).
3. If the rollback was triggered by an A/B experiment result, call
   `completeExperiment()` (or `pauseExperiment()` if you plan to re-run it
   later) so the experiment stops accepting new assignments.
4. File a follow-up to investigate the root cause of the regression before
   attempting to re-promote the problematic version.
