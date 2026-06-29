# Troubleshooting Guide

Common issues and solutions for ChenAIKit.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Stellar Network Issues](#stellar-network-issues)
- [Smart Contract Issues](#smart-contract-issues)
- [Backend API Issues](#backend-api-issues)
- [Frontend Issues](#frontend-issues)
- [AI Service Issues](#ai-service-issues)
- [Performance Issues](#performance-issues)
- [Security Issues](#security-issues)

---

## Installation Issues

### pnpm not found

**Problem:** `pnpm: command not found`

**Solution:**
```bash
# Install pnpm globally
npm install -g pnpm

# Or use npx
npx pnpm install

# Or use corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate
```

### Workspace dependencies not resolving

**Problem:** `Cannot find module '@chenaikit/core'`

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Rebuild packages
pnpm -r build
```

### TypeScript compilation errors

**Problem:** `error TS2307: Cannot find module`

**Solution:**
```bash
# Ensure TypeScript is installed
pnpm add -D typescript

# Generate Prisma client (if using backend)
cd backend
pnpm prisma:generate

# Rebuild all packages
cd ..
pnpm -r build
```

### Native module build failures

**Problem:** `gyp ERR! build error`

**Solution:**
```bash
# Install build tools (macOS)
xcode-select --install

# Install build tools (Ubuntu/Debian)
sudo apt-get install build-essential

# Install build tools (Windows)
npm install --global windows-build-tools

# Rebuild native modules
pnpm rebuild
```

---

## Stellar Network Issues

### Account not found

**Problem:** `ChenAIKitError: Account not found (ACCOUNT_NOT_FOUND)`

**Causes:**
1. Account doesn't exist on the network
2. Using wrong network (testnet vs mainnet)
3. Account not yet funded

**Solutions:**

```typescript
// 1. Verify network configuration
const stellar = new StellarConnector({
  network: 'testnet', // or 'mainnet'
  horizonUrl: 'https://horizon-testnet.stellar.org'
});

// 2. Create and fund testnet account
// Visit: https://laboratory.stellar.org/#account-creator?network=test

// 3. Check if account exists before operations
try {
  const account = await stellar.getAccount(accountId);
} catch (error) {
  if (error.code === 'ACCOUNT_NOT_FOUND') {
    console.log('Account needs to be created and funded');
  }
}
```

### Connection timeout

**Problem:** `ChenAIKitError: Request timeout (TIMEOUT_ERROR)`

**Solutions:**

```typescript
// Increase timeout
const stellar = new StellarConnector({
  network: 'testnet',
  timeout: 60000 // 60 seconds
});

// Check Horizon status
// Visit: https://status.stellar.org/

// Use alternative Horizon server
const stellar = new StellarConnector({
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org' // or other provider
});
```

### Rate limiting

**Problem:** `429 Too Many Requests`

**Solutions:**

```typescript
// Implement exponential backoff
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Use with stellar operations
const account = await fetchWithRetry(() => 
  stellar.getAccount(accountId)
);

// Batch requests
const accounts = await Promise.all(
  accountIds.map(id => stellar.getAccount(id))
);
```

### Invalid transaction

**Problem:** `Transaction failed: tx_bad_seq`

**Solutions:**

```typescript
// Fetch latest sequence number
const account = await stellar.getAccount(sourceAccount);
const sequence = account.sequence;

// Build transaction with correct sequence
const transaction = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET
})
  .addOperation(/* ... */)
  .setTimeout(30)
  .build();
```

---

## Smart Contract Issues

### Contract deployment fails

**Problem:** `soroban contract deploy` fails

**Solutions:**

```bash
# 1. Verify Rust and Soroban CLI versions
rustc --version  # Should be 1.70+
soroban --version  # Should be 20.x+

# 2. Clean and rebuild
cd contracts/credit-score
cargo clean
cargo build --target wasm32-unknown-unknown --release

# 3. Check WASM file exists
ls -lh target/wasm32-unknown-unknown/release/*.wasm

# 4. Verify network configuration
soroban config network ls

# 5. Check account balance
soroban config identity show deployer

# 6. Fund account if needed (testnet)
soroban config identity fund deployer --network testnet
```

### Contract invocation fails

**Problem:** `Error: Contract invocation failed`

**Solutions:**

```bash
# 1. Verify contract is initialized
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  has_score \
  --account $TEST_ACCOUNT

# 2. Check authorization
# Ensure you're using the correct identity
soroban config identity address deployer

# 3. Verify contract ID
echo $CONTRACT_ID

# 4. Check contract events for errors
soroban events \
  --start-ledger <recent-ledger> \
  --id $CONTRACT_ID \
  --network testnet
```

### WASM optimization issues

**Problem:** Optimized WASM is too large or fails

**Solutions:**

```bash
# 1. Use release profile
cargo build --target wasm32-unknown-unknown --release

# 2. Check Cargo.toml optimization settings
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = "symbols"

# 3. Use soroban optimize
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/credit_score.wasm

# 4. Check WASM size
ls -lh target/wasm32-unknown-unknown/release/*.wasm
```

---

## Backend API Issues

### Database connection fails

**Problem:** `Error: Can't reach database server`

**Solutions:**

```bash
# 1. Check DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL

# 2. Verify PostgreSQL is running
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Docker
docker ps | grep postgres

# 3. Test connection
psql $DATABASE_URL

# 4. Run migrations
cd backend
pnpm prisma:migrate

# 5. Generate Prisma client
pnpm prisma:generate
```

### Redis connection fails

**Problem:** `Error: Redis connection refused`

**Solutions:**

```bash
# 1. Check REDIS_URL in .env
cat backend/.env | grep REDIS_URL

# 2. Verify Redis is running
# macOS
brew services list | grep redis

# Linux
sudo systemctl status redis

# Docker
docker ps | grep redis

# 3. Test connection
redis-cli ping
# Should return: PONG

# 4. Start Redis if not running
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### JWT authentication fails

**Problem:** `401 Unauthorized` or `Invalid token`

**Solutions:**

```bash
# 1. Verify secrets are set
cat backend/.env | grep TOKEN_SECRET

# 2. Generate new secrets if needed
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 3. Update .env
ACCESS_TOKEN_SECRET=<generated-secret>
REFRESH_TOKEN_SECRET=<generated-secret>

# 4. Restart backend
cd backend
pnpm dev
```

### API rate limiting

**Problem:** `429 Too Many Requests`

**Solutions:**

```typescript
// 1. Check rate limit headers
const response = await fetch('/api/endpoint');
console.log('Rate Limit:', response.headers.get('X-RateLimit-Limit'));
console.log('Remaining:', response.headers.get('X-RateLimit-Remaining'));
console.log('Reset:', response.headers.get('X-RateLimit-Reset'));

// 2. Implement retry with backoff
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const waitTime = resetTime ? 
        new Date(resetTime).getTime() - Date.now() : 
        Math.pow(2, i) * 1000;
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}

// 3. Use API key with higher tier
const response = await fetch('/api/endpoint', {
  headers: {
    'X-API-Key': process.env.API_KEY
  }
});
```

### CORS errors

**Problem:** `Access-Control-Allow-Origin` error

**Solutions:**

```bash
# 1. Check CORS configuration in backend/.env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# 2. For development only, allow all origins
CORS_ALLOW_ALL=true

# 3. Verify backend is running
curl -I http://localhost:5000/api/health

# 4. Check browser console for exact error
# Open DevTools > Console

# 5. Use proxy in development (frontend)
# In frontend/package.json:
{
  "proxy": "http://localhost:5000"
}
```

---

## Frontend Issues

### React app won't start

**Problem:** `Error: Cannot find module` or compilation errors

**Solutions:**

```bash
# 1. Clean and reinstall
cd frontend
rm -rf node_modules
rm package-lock.json
pnpm install

# 2. Clear React cache
rm -rf node_modules/.cache

# 3. Check Node version
node --version  # Should be 18+

# 4. Verify environment variables
cat .env | grep REACT_APP_

# 5. Start with verbose logging
pnpm start --verbose
```

### API calls fail from frontend

**Problem:** `Network Error` or `Failed to fetch`

**Solutions:**

```typescript
// 1. Check API URL configuration
console.log('API URL:', process.env.REACT_APP_API_URL);

// 2. Verify backend is running
fetch('http://localhost:5000/api/health')
  .then(r => r.json())
  .then(console.log);

// 3. Check for CORS issues (see CORS section above)

// 4. Use absolute URLs in development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// 5. Add error handling
async function apiCall(endpoint) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

### Build fails

**Problem:** `Build failed` or `Out of memory`

**Solutions:**

```bash
# 1. Increase Node memory
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm build

# 2. Clear cache
rm -rf node_modules/.cache
rm -rf build

# 3. Check for TypeScript errors
pnpm type-check

# 4. Build with verbose output
pnpm build --verbose

# 5. Check disk space
df -h
```

---

## AI Service Issues

### API key invalid

**Problem:** `401 Unauthorized` or `Invalid API key`

**Solutions:**

```bash
# 1. Verify API key is set
echo $AI_API_KEY

# 2. Check .env file
cat .env | grep AI_API_KEY

# 3. Regenerate API key from dashboard
# Visit: https://dashboard.chenaikit.com/api-keys

# 4. Test API key
curl -H "Authorization: Bearer $AI_API_KEY" \
  https://api.chenaikit.com/v1/health
```

### Credit score calculation fails

**Problem:** `Error calculating credit score`

**Solutions:**

```typescript
// 1. Verify account data is complete
const account = await stellar.getAccount(accountId);
console.log('Account data:', JSON.stringify(account, null, 2));

// 2. Check for required fields
if (!account.balances || account.balances.length === 0) {
  console.error('Account has no balances');
}

// 3. Add error handling
try {
  const score = await ai.calculateCreditScore(account);
  console.log('Score:', score);
} catch (error) {
  console.error('Score calculation failed:', error.message);
  console.error('Details:', error.details);
}

// 4. Use demo mode for testing
const ai = new AIService({
  apiKey: 'demo', // Uses mock data
  baseUrl: 'https://api.chenaikit.com'
});
```

### Fraud detection timeout

**Problem:** `Request timeout` during fraud detection

**Solutions:**

```typescript
// 1. Increase timeout
const ai = new AIService({
  apiKey: process.env.AI_API_KEY,
  timeout: 120000 // 2 minutes
});

// 2. Reduce data size
const recentTransactions = transactions.slice(0, 50); // Limit to 50
const result = await detector.analyzePattern(recentTransactions);

// 3. Use batch processing
const batchSize = 20;
for (let i = 0; i < transactions.length; i += batchSize) {
  const batch = transactions.slice(i, i + batchSize);
  const result = await detector.analyzePattern(batch);
  console.log(`Batch ${i / batchSize + 1} result:`, result);
}
```

---

## Performance Issues

### Slow API responses

**Problem:** API calls take too long

**Solutions:**

```typescript
// 1. Enable caching
import { CacheService } from '@chenaikit/backend';

const cache = new CacheService({
  ttl: 300, // 5 minutes
  maxSize: 1000
});

// Cache expensive operations
async function getCachedScore(accountId) {
  const cacheKey = `score:${accountId}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const score = await ai.calculateCreditScore(accountId);
  await cache.set(cacheKey, score);
  return score;
}

// 2. Use pagination
const transactions = await stellar.getAccountTransactions(accountId, {
  limit: 20, // Smaller page size
  cursor: lastCursor
});

// 3. Implement request batching
const accountIds = ['GABC...', 'GDEF...', 'GHIJ...'];
const scores = await Promise.all(
  accountIds.map(id => getCachedScore(id))
);

// 4. Add request timeout
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000); // 10s timeout

const response = await fetch(url, {
  signal: controller.signal
});
```

### High memory usage

**Problem:** Application uses too much memory

**Solutions:**

```typescript
// 1. Limit data retention
const monitor = new TransactionMonitor({
  // ... config
  maxHistorySize: 1000 // Limit stored transactions
});

// 2. Use streaming for large datasets
import { Readable } from 'stream';

async function* streamTransactions(accountId) {
  let cursor = null;
  while (true) {
    const page = await stellar.getAccountTransactions(accountId, {
      limit: 100,
      cursor
    });
    
    for (const tx of page) {
      yield tx;
    }
    
    if (page.length < 100) break;
    cursor = page[page.length - 1].paging_token;
  }
}

// 3. Clear caches periodically
setInterval(() => {
  cache.clear();
}, 3600000); // Every hour

// 4. Monitor memory usage
console.log('Memory usage:', process.memoryUsage());
```

### Database query slow

**Problem:** Database queries are slow

**Solutions:**

```sql
-- 1. Add indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- 2. Analyze query performance
EXPLAIN ANALYZE SELECT * FROM accounts WHERE user_id = '...';

-- 3. Use connection pooling
-- In backend/.env:
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=10"
```

```typescript
// 4. Optimize Prisma queries
// Bad: N+1 query
const users = await prisma.user.findMany();
for (const user of users) {
  const accounts = await prisma.account.findMany({
    where: { userId: user.id }
  });
}

// Good: Single query with include
const users = await prisma.user.findMany({
  include: {
    accounts: true
  }
});

// 5. Use select to limit fields
const accounts = await prisma.account.findMany({
  select: {
    id: true,
    balance: true,
    // Only fields you need
  }
});
```

---

## Security Issues

### Exposed secrets

**Problem:** Secrets committed to git

**Solutions:**

```bash
# 1. Remove from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Rotate all exposed secrets immediately
# - Generate new API keys
# - Change database passwords
# - Regenerate JWT secrets

# 3. Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore

# 4. Use environment-specific files
.env.example      # Template (commit this)
.env.development  # Local dev (don't commit)
.env.production   # Production (don't commit)

# 5. Use secret management
# - HashiCorp Vault
# - AWS Secrets Manager
# - Environment variables in CI/CD
```

### SQL injection vulnerability

**Problem:** Potential SQL injection

**Solutions:**

```typescript
// Bad: String concatenation
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${email}'`
);

// Good: Parameterized query
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;

// Better: Use Prisma methods
const user = await prisma.user.findUnique({
  where: { email }
});

// Validate input
import { z } from 'zod';

const emailSchema = z.string().email();
const validatedEmail = emailSchema.parse(email);
```

### XSS vulnerability

**Problem:** Cross-site scripting risk

**Solutions:**

```typescript
// 1. Sanitize user input
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(userInput);

// 2. Use React's built-in escaping
// Good: React escapes by default
<div>{userInput}</div>

// Dangerous: Bypasses escaping
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// 3. Set Content Security Policy
// In backend/src/middleware/security.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));
```

---

## Getting Help

If you can't find a solution here:

1. **Check Documentation**
   - [Getting Started](./getting-started.md)
   - [API Reference](./api/core-sdk.md)
   - [Tutorials](./tutorials/)

2. **Search Issues**
   - [GitHub Issues](https://github.com/nexoraorg/chenaikit/issues)
   - Search for similar problems

3. **Ask Community**
   - [Discord Server](https://discord.gg/chenaikit)
   - [GitHub Discussions](https://github.com/nexoraorg/chenaikit/discussions)

4. **Report Bug**
   - [Create Issue](https://github.com/nexoraorg/chenaikit/issues/new)
   - Include error messages, logs, and reproduction steps

5. **Contact Support**
   - Email: support@chenaikit.com
   - Include your environment details and error logs

## Diagnostic Information

When reporting issues, include:

```bash
# System information
node --version
pnpm --version
rustc --version  # If using contracts
soroban --version  # If using contracts

# Package versions
cat package.json | grep version

# Environment
echo $NODE_ENV
echo $STELLAR_NETWORK

# Logs
# Backend logs
tail -n 100 backend/logs/error.log

# Frontend console errors
# Open DevTools > Console > Copy all errors
```
