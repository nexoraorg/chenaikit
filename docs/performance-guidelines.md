# Performance Guidelines and Best Practices

This document provides comprehensive guidelines for maintaining and optimizing performance across all components of ChenAIKit.

## Table of Contents

1. [Overview](#overview)
2. [Performance Metrics](#performance-metrics)
3. [API Performance](#api-performance)
4. [Database Performance](#database-performance)
5. [Frontend Performance](#frontend-performance)
6. [Smart Contract Performance](#smart-contract-performance)
7. [Monitoring and Testing](#monitoring-and-testing)
8. [Performance Budgets](#performance-budgets)
9. [Optimization Strategies](#optimization-strategies)
10. [Troubleshooting](#troubleshooting)

## Overview

ChenAIKit is designed to handle high-volume blockchain transactions and real-time analytics. Performance is critical for user experience and system reliability. This guide establishes performance standards and optimization practices.

### Performance Goals

- **API Response Time**: < 200ms for 95th percentile
- **Database Query Time**: < 100ms for typical queries
- **Frontend Load Time**: < 3s on 3G networks
- **Smart Contract Gas**: < 50,000 gas for standard operations
- **System Uptime**: > 99.9%
- **Concurrent Users**: Support 10,000+ concurrent users

## Performance Metrics

### Key Performance Indicators (KPIs)

#### API Metrics
- **Response Time**: Time to process and return response
- **Throughput**: Requests per second (RPS)
- **Error Rate**: Percentage of failed requests
- **Latency**: Network + processing time
- **Availability**: Uptime percentage

#### Database Metrics
- **Query Execution Time**: Time to execute queries
- **Index Usage**: Efficiency of database indexes
- **Connection Pool**: Active vs available connections
- **Cache Hit Rate**: Query cache effectiveness
- **Disk I/O**: Read/write operations per second

#### Frontend Metrics
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms
- **Time to Interactive (TTI)**: < 5s

#### Smart Contract Metrics
- **Gas Usage**: Gas consumed per operation
- **Execution Time**: Block processing time
- **Storage Costs**: Data storage efficiency
- **Call Success Rate**: Percentage of successful calls

## API Performance

### Response Time Targets

| Endpoint Type | Target (95th percentile) | Maximum |
|---------------|-------------------------|---------|
| Health Check  | < 50ms                  | 100ms   |
| Authentication| < 100ms                 | 200ms   |
| Data Retrieval| < 200ms                 | 500ms   |
| Data Creation | < 300ms                 | 600ms   |
| Analytics     | < 500ms                 | 1000ms  |

### Optimization Strategies

#### 1. Caching
```javascript
// Redis caching implementation
const cache = require('redis').createClient();

async function getCachedData(key) {
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchDataFromDatabase();
  await cache.setex(key, 300, JSON.stringify(data)); // 5 minutes
  return data;
}
```

#### 2. Database Connection Pooling
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  max: 20,        // Maximum connections
  min: 5,         // Minimum connections
  idle: 10000,    // Idle timeout
  acquire: 60000, // Acquire timeout
});
```

#### 3. Response Compression
```javascript
const compression = require('compression');
app.use(compression({
  threshold: 1024, // Only compress responses > 1KB
  level: 6,       // Compression level (1-9)
}));
```

#### 4. Request Validation
```javascript
// Early validation to prevent unnecessary processing
const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};
```

### Load Testing

Use the provided load testing scripts:

```bash
# Run API load tests
k6 run tests/performance/api-load-test.js

# Run stress test
k6 run --vus 1000 --duration 5m tests/performance/api-load-test.js

# Run spike test
k6 run tests/performance/spike-test.js
```

## Database Performance

### Query Optimization

#### 1. Index Strategy
```sql
-- Create composite indexes for frequent queries
CREATE INDEX CONCURRENTLY idx_transactions_user_status 
ON transactions(user_id, status, created_at);

-- Partial indexes for filtered queries
CREATE INDEX CONCURRENTLY idx_active_users 
ON users(id) WHERE status = 'active';
```

#### 2. Query Analysis
```sql
-- Analyze slow queries
EXPLAIN (ANALYZE, BUFFERS) 
SELECT t.*, u.email 
FROM transactions t 
JOIN users u ON t.user_id = u.id 
WHERE t.created_at >= NOW() - INTERVAL '7 days';

-- Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE schemaname = 'public';
```

#### 3. Connection Management
```javascript
// Use connection pooling
const pool = new Pool({
  max: 20,
  min: 5,
  idle: 10000,
  acquire: 60000,
  evict: 1000,
});

// Handle connection errors
pool.on('error', (err) => {
  console.error('Database connection error:', err);
});
```

### Performance Monitoring

Run database performance tests:

```bash
# Execute performance tests
psql -d chenaikit -f tests/performance/database-performance-tests.sql

# Analyze query performance
SELECT * FROM analyze_query_performance();

# Check index efficiency
SELECT * FROM analyze_index_usage();
```

## Frontend Performance

### Core Web Vitals Optimization

#### 1. Image Optimization
```javascript
// Responsive images with lazy loading
<img 
  src="image-small.jpg"
  srcset="image-small.jpg 300w, image-medium.jpg 600w, image-large.jpg 1200w"
  sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px"
  loading="lazy"
  alt="Description"
/>
```

#### 2. Code Splitting
```javascript
// Dynamic imports for route-based code splitting
const Dashboard = lazy(() => import('./components/Dashboard'));
const Analytics = lazy(() => import('./components/Analytics'));

// Component-level code splitting
const HeavyComponent = lazy(() => 
  import('./components/HeavyComponent').then(module => ({
    default: module.HeavyComponent
  }))
);
```

#### 3. Bundle Optimization
```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
```

#### 4. Service Worker Caching
```javascript
// Service worker for offline caching
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
```

### Performance Testing

```bash
# Run frontend performance tests
node tests/performance/frontend-metrics.js

# Run Lighthouse audit
npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json

# Run performance budgets
npx lighthouse http://localhost:3000 --budget-path=./performance-budget.json
```

## Smart Contract Performance

### Gas Optimization

#### 1. Storage Optimization
```rust
// Use packed structs to reduce storage slots
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "stellar_sdk::serde")]
pub struct CreditScore {
    #[serde(rename = "u")]  // Short field names
    user_id: u64,
    #[serde(rename = "s")]
    score: u16,  // Use smaller types when possible
    #[serde(rename = "t")]
    timestamp: u32,
}
```

#### 2. Efficient Data Structures
```rust
// Use mappings instead of arrays for large datasets
pub struct CreditScoreContract {
    // Efficient mapping instead of array
    scores: Map<u64, CreditScore>,
    // Use event-based updates instead of storage
    last_updated: u64,
}
```

#### 3. Batch Operations
```rust
// Process multiple operations in single transaction
pub fn batch_update_scores(&mut self, updates: Vec<(u64, u16)>) {
    for (user_id, score) in updates {
        self.scores.insert(user_id, CreditScore {
            user_id,
            score,
            timestamp: env::block_timestamp(),
        });
    }
}
```

### Contract Testing

```bash
# Run contract benchmarks
cargo test --release --package credit-score --bench

# Gas usage analysis
cargo run --package contract-benchmarks

# Stellar testnet deployment testing
stellar contract deploy --source credit-score.wasm --network testnet
```

## Monitoring and Testing

### Continuous Monitoring

#### 1. Application Performance Monitoring (APM)
```javascript
// APM integration (e.g., New Relic, DataDog)
const apm = require('elastic-apm-node').start({
  serviceName: 'chenaikit-api',
  secretToken: process.env.APM_SECRET_TOKEN,
  environment: process.env.NODE_ENV,
});

// Custom metrics
apm.setCustomContext({
  userId: req.user.id,
  operation: 'transaction_processing',
});
```

#### 2. Real User Monitoring (RUM)
```javascript
// Frontend monitoring
import { init as sentryInit } from '@sentry/browser';

sentryInit({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Performance monitoring
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'navigation') {
      console.log('Page load time:', entry.loadEventEnd - entry.fetchStart);
    }
  }
});
observer.observe({ entryTypes: ['navigation'] });
```

### Automated Testing

#### 1. Performance Budgets
```json
{
  "budgets": [
    {
      "path": "dashboard.js",
      "maxSize": "150kb",
      "maxTotalKb": 300,
      "maxIncrementalKb": 50
    },
    {
      "path": "analytics.js",
      "maxSize": "200kb",
      "maxTotalKb": 400,
      "maxIncrementalKb": 75
    }
  ]
}
```

#### 2. CI/CD Integration
```yaml
# GitHub Actions workflow
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Run API Load Tests
        run: k6 run tests/performance/api-load-test.js
      - name: Run Frontend Tests
        run: npm run test:performance
      - name: Run Database Tests
        run: npm run test:db-performance
```

## Performance Budgets

### API Budgets

| Metric | Budget | Alert Threshold |
|--------|--------|-----------------|
| Response Time (p95) | 200ms | 300ms |
| Error Rate | 0.1% | 1% |
| Throughput | 1000 RPS | 800 RPS |
| Memory Usage | 512MB | 768MB |
| CPU Usage | 70% | 85% |

### Frontend Budgets

| Metric | Budget | Alert Threshold |
|--------|--------|-----------------|
| Bundle Size (total) | 1MB | 1.5MB |
| First Contentful Paint | 1.5s | 2.5s |
| Largest Contentful Paint | 2.5s | 4s |
| Cumulative Layout Shift | 0.1 | 0.25 |
| First Input Delay | 100ms | 300ms |

### Database Budgets

| Metric | Budget | Alert Threshold |
|--------|--------|-----------------|
| Query Time (avg) | 50ms | 100ms |
| Query Time (p95) | 100ms | 200ms |
| Index Usage | 95% | 80% |
| Cache Hit Rate | 90% | 75% |
| Connection Pool Usage | 80% | 90% |

### Smart Contract Budgets

| Operation | Gas Budget | Alert Threshold |
|-----------|------------|-----------------|
| Credit Score Query | 5,000 | 10,000 |
| Credit Score Update | 15,000 | 25,000 |
| Fraud Analysis | 20,000 | 35,000 |
| Governance Vote | 10,000 | 20,000 |

## Optimization Strategies

### 1. Caching Strategies

#### Multi-Level Caching
```javascript
// L1: In-memory cache
const memoryCache = new Map();

// L2: Redis cache
const redisCache = require('redis').createClient();

// L3: Database query cache
async function getData(key) {
  // Check L1 cache
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  
  // Check L2 cache
  const redisData = await redisCache.get(key);
  if (redisData) {
    memoryCache.set(key, JSON.parse(redisData));
    return JSON.parse(redisData);
  }
  
  // Fetch from database
  const dbData = await fetchFromDatabase(key);
  
  // Cache in both levels
  memoryCache.set(key, dbData);
  await redisCache.setex(key, 300, JSON.stringify(dbData));
  
  return dbData;
}
```

#### Cache Invalidation
```javascript
// Intelligent cache invalidation
function invalidateCache(pattern) {
  // Invalidate memory cache
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
  
  // Invalidate Redis cache
  redisCache.keys(`*${pattern}*`).then(keys => {
    if (keys.length > 0) {
      redisCache.del(...keys);
    }
  });
}
```

### 2. Database Optimization

#### Query Optimization
```sql
-- Use CTEs for complex queries
WITH user_transactions AS (
  SELECT user_id, COUNT(*) as tx_count, SUM(amount) as total_amount
  FROM transactions 
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
),
user_scores AS (
  SELECT user_id, score
  FROM credit_scores
  WHERE updated_at >= NOW() - INTERVAL '30 days'
)
SELECT u.email, ut.tx_count, ut.total_amount, us.score
FROM users u
LEFT JOIN user_transactions ut ON u.id = ut.user_id
LEFT JOIN user_scores us ON u.id = us.user_id;
```

#### Partitioning
```sql
-- Partition large tables by date
CREATE TABLE transactions (
    id BIGSERIAL,
    user_id INTEGER,
    amount NUMERIC(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE transactions_2024_01 PARTITION OF transactions
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 3. Frontend Optimization

#### Bundle Analysis
```javascript
// webpack-bundle-analyzer
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    }),
  ],
};
```

#### Tree Shaking
```javascript
// Enable tree shaking in package.json
{
  "sideEffects": [
    "./src/styles/**/*.css",
    "./src/components/**/*.css"
  ]
}

// Import only what you need
import { debounce } from 'lodash-es/debounce';
// Instead of: import _ from 'lodash';
```

## Troubleshooting

### Common Performance Issues

#### 1. Slow API Responses
**Symptoms**: High response times, timeout errors
**Causes**: Database queries, external API calls, inefficient algorithms
**Solutions**:
- Add database indexes
- Implement caching
- Optimize algorithms
- Use connection pooling

#### 2. High Memory Usage
**Symptoms**: Out of memory errors, frequent garbage collection
**Causes**: Memory leaks, large objects, inefficient data structures
**Solutions**:
- Profile memory usage
- Implement object pooling
- Use streaming for large datasets
- Optimize data structures

#### 3. Frontend Performance
**Symptoms**: Slow page loads, layout shifts, poor user experience
**Causes**: Large bundles, unoptimized images, render-blocking resources
**Solutions**:
- Implement code splitting
- Optimize images and assets
- Use lazy loading
- Minimize render-blocking resources

#### 4. Database Performance
**Symptoms**: Slow queries, connection timeouts, high CPU usage
**Causes**: Missing indexes, inefficient queries, poor connection management
**Solutions**:
- Add appropriate indexes
- Optimize query structure
- Implement connection pooling
- Use query caching

### Performance Debugging Tools

#### API Debugging
```bash
# Profile Node.js application
node --inspect app.js

# Memory profiling
node --prof app.js
node --prof-process isolate-*.log > performance.txt

# CPU profiling
clinic doctor -- node app.js
```

#### Database Debugging
```bash
# Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 100;

# Analyze slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

#### Frontend Debugging
```bash
# Chrome DevTools
# Performance tab: Record and analyze runtime performance
# Network tab: Analyze resource loading
# Coverage tab: Identify unused code

# Lighthouse CLI
npx lighthouse http://localhost:3000 --view
```

### Performance Alerts

Set up monitoring alerts for:

1. **API Response Time**: Alert if p95 > 300ms
2. **Error Rate**: Alert if > 1%
3. **Database Query Time**: Alert if avg > 100ms
4. **Frontend Performance**: Alert if LCP > 4s
5. **Memory Usage**: Alert if > 80% of allocated memory
6. **CPU Usage**: Alert if > 85% sustained

### Performance Regression Testing

Implement automated performance regression tests:

```javascript
// Performance regression test
describe('Performance Regression Tests', () => {
  it('should maintain API response times', async () => {
    const start = Date.now();
    await request(app).get('/api/dashboard');
    const responseTime = Date.now() - start;
    
    expect(responseTime).toBeLessThan(200);
  });
  
  it('should maintain bundle size', async () => {
    const stats = await webpack.compile();
    const bundleSize = stats.toJson().assets[0].size;
    
    expect(bundleSize).toBeLessThan(1024 * 1024); // 1MB
  });
});
```

## Best Practices Summary

1. **Monitor Continuously**: Implement comprehensive monitoring across all components
2. **Set Performance Budgets**: Define and enforce performance budgets
3. **Test Regularly**: Run performance tests in CI/CD pipeline
4. **Optimize Proactively**: Address performance issues before they impact users
5. **Use Caching Strategically**: Implement multi-level caching where appropriate
6. **Profile Before Optimizing**: Use profiling tools to identify bottlenecks
7. **Keep Dependencies Updated**: Regular updates often include performance improvements
8. **Document Performance Decisions**: Maintain performance documentation for team reference

## Resources

- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [k6 Load Testing](https://k6.io/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance.html)
- [Stellar Soroban](https://soroban.stellar.org/)

For questions or contributions to these guidelines, please create an issue or pull request in the repository.
