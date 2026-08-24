# model-attestation

Soroban registry for **model attestation records**. Consumers use these
records to distinguish current evidence from revoked or stale evidence.

## Lifecycle states

| State | Meaning |
| --- | --- |
| *(absent)* | No record for the given `record_id`. |
| `Active` | Record exists and is valid evidence. |
| `Invalidated` | Record was revoked; must not be treated as current evidence. |

Each stored record also carries a monotonic `version` (starts at `1`) so
callers can detect concurrent or out-of-date writes.

## Valid transitions

```
absent ──create_attestation──▶ Active (v1)
Active  ──update_attestation──▶ Active (vN+1, new model_hash)
Active  ──invalidate_attestation──▶ Invalidated (terminal)
```

- **create** — admin only; fails if the `record_id` already exists.
- **update** — admin only; requires `expected_version == stored.version`;
  bumps version and replaces `model_hash`.
- **invalidate** — admin only; requires `expected_version == stored.version`;
  sets status to `Invalidated` and records `invalidated_at`.

`Invalidated` is terminal: further updates or invalidations are rejected.

## Rejected transitions

| Attempt | Error |
| --- | --- |
| Mutate before `initialize` | `NotInitialized` |
| Non-admin caller | `Unauthorized` |
| Create when `record_id` exists | `AlreadyExists` |
| Update / invalidate missing id | `NotFound` |
| Update / invalidate when already `Invalidated` | `AlreadyInvalidated` |
| Update / invalidate with wrong `expected_version` | `StaleVersion` |

Stale-version rejection keeps storage unchanged so consumers never observe a
partial or out-of-order write.

## Entry points

- `initialize(admin)`
- `create_attestation(caller, record_id, model_hash) -> AttestationRecord`
- `update_attestation(caller, record_id, model_hash, expected_version) -> AttestationRecord`
- `invalidate_attestation(caller, record_id, expected_version) -> AttestationRecord`
- `get_attestation(record_id) -> Option<AttestationRecord>`

## Testing

```bash
cd contracts
cargo test -p model-attestation
```

Lifecycle tests live in `src/lib.rs` and assert both call outcomes and the
final stored state after every transition.
