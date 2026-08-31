# oracle-network

Soroban multi-source oracle for ChenAIKit feeds. Aggregation **rejects**
missing, delayed, or inconsistent data instead of treating it as current.

## Assumptions

- Only admin-registered sources may submit readings.
- Each reading carries an `observed_at` unix timestamp (seconds).
- Consumers must call `aggregate(feed_id)` for a current quote. Raw
  `get_reading` returns stored evidence and does **not** imply freshness.

## Stale-data threshold

| Constant | Value | Meaning |
| --- | --- | --- |
| `STALE_THRESHOLD_SECS` | `300` (5 minutes) | Reading is stale when `now - observed_at > 300`. |
| `MIN_FRESH_SOURCES` | `2` | Quote requires at least two **fresh** sources. |

Age equal to `300` is still current. Age `301+` is stale.

Stale readings are ignored for quorum. They **cannot** pad a missing
fresh source. If every stored reading is stale, `aggregate` returns
`StaleData` — not a quote.

## Conflict handling (deterministic)

| Constant | Value | Meaning |
| --- | --- | --- |
| `MAX_DEVIATION_BPS` | `500` (5%) | Max deviation from the median. |

1. Collect fresh values only.
2. Sort ascending.
3. Median is `values[len / 2]` (upper middle on even length). No averaging.
4. If any fresh value exceeds `500` bps from that median, reject with
   `ConflictingSources`.

There is **no fallback** to a single source, last-write, or “closest”
value. Conflict always yields the same error for the same inputs.

When the median is `0`, any non-zero fresh value is a conflict.

## Failure modes

| Situation | Error | Consumer behavior |
| --- | --- | --- |
| No submissions for the feed | `SourceUnavailable` | Do not use a default price/score. |
| Readings exist but all are stale | `StaleData` | Data is delayed; do not treat as current. |
| Fewer than 2 fresh sources | `InsufficientSources` | Do not fall back to one source (or a stale peer). |
| Fresh sources disagree beyond 5% | `ConflictingSources` | Do not pick a winner. |
| Unregistered source submits | `Unauthorized` | Ignore; storage unchanged. |

Successful `aggregate` returns `AggregatedQuote { value, source_count, observed_at }`
where `observed_at` is the newest fresh reading used.

## Entry points

- `initialize(admin)`
- `stale_threshold_secs() -> u64`
- `register_source(caller, source)`
- `submit_reading(source, feed_id, value, observed_at) -> OracleReading`
- `get_reading(feed_id, source) -> Option<OracleReading>`
- `aggregate(feed_id) -> AggregatedQuote`

## Testing

```bash
cd contracts
cargo test -p oracle-network
```
