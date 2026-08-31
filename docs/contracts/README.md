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
