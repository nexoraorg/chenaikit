# Error Handling & System Resilience

Comprehensive guide to error recovery, retry mechanisms, and graceful degradation in ChenAIKit.

---

## Overview

ChenAIKit implements multiple layers of resilience:

- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breakers**: Prevent cascading failures
- **Fallback Mechanisms**: Graceful degradation when services fail
- **Error Tracking**: Centralized monitoring with Sentry
- **Health Checks**: Service availability monitoring
- **Dead Letter Queues**: Failed job recovery

---

## Retry Logic

### Basic Usage

```typescript
import { retry, isRetryableError } from '@chenaikit/core/utils/retry';

const result = await retry(
  async () => {
    return await fetchData();
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    onRetry: (error, attempt) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    }
  }
);
```

### Retryable Errors

The system automatically retries:
- Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
- HTTP 429 (Rate Limit), 503 (Service Unavailable), 504 (Gateway Timeout)
- HTTP 5xx server errors

---

## Circuit Breaker

Prevents overwhelming failing services by "opening" the circuit after repeated failures.

### States

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service failing, requests rejected immediately
- **HALF_OPEN**: Testing if service recovered

### Usage

```typescript
import { CircuitBreaker } from '@chenaikit/core/utils/circuit-breaker';

const breaker = new CircuitBreaker(
  async (accountId: string) => {
    return await stellarAPI.getAccount(accountId);
  },
  {
    failureThreshold: 5,      // Open after 5 failures
    successThreshold: 2,       // Close after 2 successes in HALF_OPEN
    timeout: 60000,            // Request timeout (60s)
    resetTimeout: 30000,       // Try HALF_OPEN after 30s
    onStateChange: (state) => {
      console.log(`Circuit breaker: ${state}`);
    }
  }
);

const account = await breaker.execute('GXXX...');
```

---

## AI Service Fallbacks

When AI services fail, the system uses rule-based fallbacks.

### Credit Scoring Fallback

```typescript
import { AIServiceWithResilience } from '@chenaikit/core/services/ai-resilient';

const aiService = new AIServiceWithResilience({
  apiKey: process.env.AI_API_KEY,
  endpoint: 'https://api.example.com',
  fallbackEnabled: true
});

const result = await aiService.calculateCreditScore(accountData);
// result.source = 'ai' | 'fallback'
```

Fallback calculation:
- Base score: 500
- Balance factor: +50 per 10k units
- Account age: +100 per year
- Transaction count: +50 per 100 transactions
- Confidence: 0.6 (vs 0.9+ for AI)

### Fraud Detection Fallback

Simple rule-based detection:
- Flag transactions > 100k
- Flag high velocity (>10 tx/hour)
- Confidence: 0.5

---

## Error Tracking with Sentry

### Setup

```typescript
import { initSentry, sentryRequestHandler, sentryErrorHandler } from './middleware/errorTracking';

initSentry(process.env.SENTRY_DSN!, process.env.NODE_ENV);

app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Your routes here

app.use(sentryErrorHandler());
```

### Manual Error Capture

```typescript
import { captureError } from './middleware/errorTracking';

try {
  await riskyOperation();
} catch (error) {
  captureError(error, {
    userId: user.id,
    operation: 'riskyOperation',
    context: { /* additional data */ }
  });
  throw error;
}
```

---

## Health Checks

### Endpoints

- `GET /health` - Overall system health
- `GET /health/liveness` - Is the service running?
- `GET /health/readiness` - Is the service ready to accept traffic?

### Register Custom Checks

```typescript
import { registerHealthCheck } from './routes/health';

registerHealthCheck('database', async () => {
  try {
    await db.query('SELECT 1');
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
});

registerHealthCheck('stellar', async () => {
  try {
    await stellar.getNetwork();
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
});
```

### Response Format

```json
{
  "status": "healthy",
  "timestamp": "2026-03-09T13:50:55.563Z",
  "uptime": 3600,
  "services": {
    "database": { "status": "up", "responseTime": 12 },
    "stellar": { "status": "up", "responseTime": 245 },
    "ai": { "status": "down", "error": "Connection timeout" }
  }
}
```

Status codes:
- `200` - Healthy
- `207` - Degraded (some services down)
- `503` - Unhealthy

---

## Job Queues & Dead Letter Queues

### Setup

```typescript
import { JobQueue } from './services/jobQueue';

const queue = new JobQueue('credit-scoring', process.env.REDIS_URL!);

queue.process(5, async (job) => {
  const { accountId } = job.data;
  const score = await calculateScore(accountId);
  return score;
});
```

### Add Jobs

```typescript
await queue.add(
  { accountId: 'GXXX...', userId: '123' },
  {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
);
```

### Handle Failed Jobs

```typescript
// View dead letter queue
const failedJobs = await queue.getDeadLetterJobs();

// Retry specific job
await queue.retryDeadLetterJob('dlq-job-123');
```

---

## React Error Boundaries

### Usage

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      fallback={<div>Custom error UI</div>}
      onError={(error, errorInfo) => {
        console.error('App error:', error);
      }}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

---

## Best Practices

### 1. Layer Your Resilience

```typescript
// Combine retry + circuit breaker + fallback
const result = await retry(
  () => circuitBreaker.execute(data),
  { maxAttempts: 3 }
).catch(() => fallbackFunction(data));
```

### 2. Set Appropriate Timeouts

- API calls: 30s
- Database queries: 10s
- AI inference: 60s
- Health checks: 5s

### 3. Log with Context

```typescript
console.error('Operation failed', {
  userId,
  operation: 'creditScore',
  attempt: 2,
  error: error.message
});
```

### 4. Monitor Circuit Breaker States

Alert when circuits stay OPEN for extended periods.

### 5. Review Dead Letter Queues

Set up daily reviews of failed jobs to identify systemic issues.

---

## Dependencies

```json
{
  "dependencies": {
    "@sentry/node": "^7.x",
    "bull": "^4.x",
    "express": "^4.x"
  }
}
```

---

## Environment Variables

```bash
SENTRY_DSN=https://xxx@sentry.io/xxx
NODE_ENV=production
REDIS_URL=redis://localhost:6379
AI_API_KEY=your-api-key
```

---

## Testing Resilience

### Simulate Failures

```typescript
// Test retry logic
const flaky = jest.fn()
  .mockRejectedValueOnce(new Error('Fail 1'))
  .mockRejectedValueOnce(new Error('Fail 2'))
  .mockResolvedValueOnce('Success');

const result = await retry(flaky, { maxAttempts: 3 });
expect(result).toBe('Success');
```

### Test Circuit Breaker

```typescript
const breaker = new CircuitBreaker(failingFn, { failureThreshold: 2 });

await expect(breaker.execute()).rejects.toThrow();
await expect(breaker.execute()).rejects.toThrow();

expect(breaker.getState()).toBe(CircuitState.OPEN);
```

---

## Monitoring & Alerts

Set up alerts for:
- Circuit breaker state changes
- High retry rates (>20%)
- Dead letter queue growth
- Health check failures
- Error rate spikes (>5%)

---

## Support

For issues or questions, see [GitHub Issues](https://github.com/chenaikit/chenaikit/issues).
