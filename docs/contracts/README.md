# Contracts documentation

Move the following files here from the old `contracts/` root as part of the
migration (task 2 in issue #286):

- `UPGRADE_CHECKLIST.md`
- `UPGRADE_IMPLEMENTATION_SUMMARY.md`
- `UPGRADE_QUICK_REFERENCE.md`
- `UPGRADE_README.md`
- `audit-report.md`

`git mv` each one into this directory to preserve history, e.g.:

```bash
git mv contracts/UPGRADE_CHECKLIST.md docs/contracts/UPGRADE_CHECKLIST.md
```

## Error Categories

All contracts share a single `ErrorCategory` enum from `common-utils`. Contracts
return `ErrorCategory` directly as their error type; clients branch on the stable
`u32` code, never on the `Debug` string representation.

| Variant | Code | Meaning |
|---------|------|---------|
| `Authorization` | 1 | Caller lacks authorization (authn/authz failure). |
| `Validation` | 2 | Invalid input; range/format check failed. |
| `Dependency` | 3 | External or cross-contract dependency failed. |
| `Internal` | 4 | Internal invariant violated (a bug). |
| `NotFound` | 5 | Required resource or entity not found. |

### Stability Guarantee

Codes **1–5 are immutable**. New categories may append at **6+**. Existing
codes must never be reused or renumbered.

### Client Contract

Clients distinguish failures by the `u32` code returned from the contract:

```rust
use common_utils::ErrorCategory;

let category = ErrorCategory::Validation;
let code = category as u32; // 2
```

The `Debug` output of `ErrorCategory` is **diagnostic only** and is not part of
the stable contract. Clients must never parse error strings.

## Deterministic Ledger Time & Boundary Semantics

Soroban contracts never read host wall-clock time; all time-sensitive logic uses
`env.ledger().timestamp()` (`u64` UNIX seconds). Contract unit tests must
explicitly set the simulated ledger timestamp via
`env.ledger().with_mut(|li| li.timestamp = ...)` rather than relying on the
implicit `0` default.

### Per-contract timestamp assumptions & exact boundaries

| Contract | Time-dependent entry points | Boundary rule |
| --- | --- | --- |
| `credit-score` | `record_score`, `update_score` | Stamps `updated_at = env.ledger().timestamp()` (`0..=u64::MAX`). |
| `governance` | `create_proposal`, `vote`, `finalize` | `create_proposal` requires `end_time > start_time` (`end_time == start_time` panics); `vote` is open while `current_time < end_time` (`current_time == end_time - 1` succeeds, `current_time == end_time` panics); `finalize` is allowed at `current_time >= end_time` (`current_time == end_time - 1` panics, `current_time == end_time` succeeds). |
| `model-attestation` | `create_attestation`, `update_attestation`, `invalidate_attestation` | `create_attestation` sets `created_at = updated_at = now`; `update_attestation` preserves `created_at` and updates `updated_at = now`; `invalidate_attestation` sets `updated_at = now` and `invalidated_at = Some(now)`. |
| `oracle-network` | `aggregate` | A reading is fresh when `now.saturating_sub(observed_at) <= STALE_THRESHOLD_SECS` (`300s`). Age `300s` is accepted; age `301s` (`STALE_THRESHOLD_SECS + 1`) is rejected with `Error::StaleData`. |
| `fraud-detect` | `analyze_transaction`, `get_risk_score`, `get_indicators` | Evaluates velocity windows against `window_start = current_time.saturating_sub(velocity_window)`. Transactions with `timestamp >= window_start && timestamp <= current_time` are included (`current_time - timestamp == velocity_window` is included; `velocity_window + 1` is excluded). |
