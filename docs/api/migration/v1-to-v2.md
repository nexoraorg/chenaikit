# Migration guide: v1 → v2

This guide helps you move from API **v1** (deprecated, sunset **2026-12-31**) to
**v2** (current). Plan to migrate before the sunset date — after it, v1 requests
return `410 Gone`.

## 1. Select v2

Pick whichever versioning style suits your client:

```http
GET /api/v2/credit-score            # URL path (recommended)
GET /api/credit-score               # + header  Accept-Version: v2
GET /api/credit-score?version=v2    # query parameter
```

Confirm the version that served your request via the `X-API-Version` response
header.

## 2. Update response parsing

### `GET /credit-score`

**v1 (before):**

```json
{
  "success": true,
  "data": {
    "score": 720,
    "factors": ["payment_history", "credit_utilization", "account_age"],
    "timestamp": "2026-06-18T00:00:00.000Z"
  }
}
```

**v2 (after):**

```json
{
  "success": true,
  "data": {
    "creditScore": {
      "value": 720,
      "band": "excellent",
      "factors": [
        { "name": "payment_history", "weight": null },
        { "name": "credit_utilization", "weight": null },
        { "name": "account_age", "weight": null }
      ]
    },
    "meta": {
      "generatedAt": "2026-06-18T00:00:00.000Z",
      "model": "credit-score-v2"
    }
  }
}
```

| v1 field          | v2 field                           |
| ----------------- | ---------------------------------- |
| `data.score`      | `data.creditScore.value`           |
| `data.factors[i]` | `data.creditScore.factors[i].name` |
| `data.timestamp`  | `data.meta.generatedAt`            |
| —                 | `data.creditScore.band` (new)      |

### `GET /fraud/detect`

| v1 field          | v2 field                     |
| ----------------- | ---------------------------- |
| `data.riskScore`  | `data.fraud.riskScore`       |
| `data.riskLevel`  | `data.fraud.riskLevel`       |
| `data.factors[i]` | `data.fraud.factors[i].name` |
| `data.timestamp`  | `data.meta.generatedAt`      |

## 3. Compatibility layer

If you cannot migrate all consumers at once, both versions run concurrently
during the migration period. A simple shim can normalize v2 back to the v1 shape
while you transition:

```ts
function v2CreditToV1(data) {
  return {
    score: data.creditScore.value,
    factors: data.creditScore.factors.map((f) => f.name),
    timestamp: data.meta.generatedAt,
  };
}
```

## 4. Unchanged endpoints

`accounts`, `auth`, and `feature-flags` are unchanged between v1 and v2 — only
the path/header/query version differs.

## Checklist

- [ ] Switch requests to v2 (path, header, or query).
- [ ] Update `credit-score` and `fraud/detect` response parsing.
- [ ] Remove any dependency on the `Deprecation`/`Warning` headers.
- [ ] Verify `X-API-Version: v2` on responses.
- [ ] Complete before **2026-12-31** (v1 sunset).
