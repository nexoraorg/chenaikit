import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestRate = new Counter('requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 300 }, // Ramp up to 300 users
    { duration: '5m', target: 300 }, // Stay at 300 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'test3@example.com', password: 'password123' },
];

const testTransactions = [
  { amount: 100, currency: 'USD', recipient: 'GABC123...' },
  { amount: 250, currency: 'USD', recipient: 'GDEF456...' },
  { amount: 500, currency: 'USD', recipient: 'GHI789...' },
];

export function setup() {
  // Setup: Create test users and get auth tokens
  const tokens = [];
  
  for (const user of testUsers) {
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (registerResponse.status === 201) {
      const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: user.email,
        password: user.password,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (loginResponse.status === 200) {
        tokens.push(loginResponse.json('token'));
      }
    }
  }
  
  return { tokens };
}

export default function(data) {
  const tokens = data.tokens;
  const token = tokens[Math.floor(Math.random() * tokens.length)];
  
  // Test 1: Health Check
  const healthResponse = http.get(`${BASE_URL}/api/health`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const healthOk = check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  errorRate.add(!healthOk);
  responseTime.add(healthResponse.timings.duration);
  requestRate.add(1);
  
  // Test 2: Get Dashboard Data
  const dashboardResponse = http.get(`${BASE_URL}/api/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const dashboardOk = check(dashboardResponse, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time < 300ms': (r) => r.timings.duration < 300,
    'dashboard has data': (r) => r.json('data') !== undefined,
  });
  
  errorRate.add(!dashboardOk);
  responseTime.add(dashboardResponse.timings.duration);
  requestRate.add(1);
  
  // Test 3: Get Transactions
  const transactionsResponse = http.get(`${BASE_URL}/api/transactions?limit=50`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const transactionsOk = check(transactionsResponse, {
    'transactions status is 200': (r) => r.status === 200,
    'transactions response time < 400ms': (r) => r.timings.duration < 400,
    'transactions has data': (r) => Array.isArray(r.json('data')),
  });
  
  errorRate.add(!transactionsOk);
  responseTime.add(transactionsResponse.timings.duration);
  requestRate.add(1);
  
  // Test 4: Get Analytics
  const analyticsResponse = http.get(`${BASE_URL}/api/analytics/overview`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const analyticsOk = check(analyticsResponse, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics response time < 500ms': (r) => r.timings.duration < 500,
    'analytics has metrics': (r) => r.json('metrics') !== undefined,
  });
  
  errorRate.add(!analyticsOk);
  responseTime.add(analyticsResponse.timings.duration);
  requestRate.add(1);
  
  // Test 5: Create Transaction (POST request)
  const transaction = testTransactions[Math.floor(Math.random() * testTransactions.length)];
  const createTransactionResponse = http.post(`${BASE_URL}/api/transactions`, JSON.stringify(transaction), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  const createTransactionOk = check(createTransactionResponse, {
    'create transaction status is 201': (r) => r.status === 201,
    'create transaction response time < 600ms': (r) => r.timings.duration < 600,
    'transaction created': (r) => r.json('id') !== undefined,
  });
  
  errorRate.add(!createTransactionOk);
  responseTime.add(createTransactionResponse.timings.duration);
  requestRate.add(1);
  
  // Test 6: Get Alerts
  const alertsResponse = http.get(`${BASE_URL}/api/alerts?limit=20`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const alertsOk = check(alertsResponse, {
    'alerts status is 200': (r) => r.status === 200,
    'alerts response time < 300ms': (r) => r.timings.duration < 300,
    'alerts has data': (r) => Array.isArray(r.json('data')),
  });
  
  errorRate.add(!alertsOk);
  responseTime.add(alertsResponse.timings.duration);
  requestRate.add(1);
  
  // Test 7: WebSocket Connection (simulated)
  const wsResponse = http.get(`${BASE_URL}/api/websocket/status`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const wsOk = check(wsResponse, {
    'websocket status is 200': (r) => r.status === 200,
    'websocket response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  errorRate.add(!wsOk);
  responseTime.add(wsResponse.timings.duration);
  requestRate.add(1);
  
  sleep(1); // Wait between requests
}

export function teardown(data) {
  // Cleanup: Remove test users
  for (const user of testUsers) {
    http.del(`${BASE_URL}/api/auth/account`, JSON.stringify({ email: user.email }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Stress test configuration
export const stressTestOptions = {
  stages: [
    { duration: '1m', target: 500 },  // Ramp up to 500 users
    { duration: '3m', target: 500 },  // Stay at 500 users
    { duration: '1m', target: 1000 }, // Ramp up to 1000 users
    { duration: '3m', target: 1000 }, // Stay at 1000 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.2'],      // Error rate under 20%
  },
};

// Spike test configuration
export const spikeTestOptions = {
  stages: [
    { duration: '1m', target: 50 },   // Normal load
    { duration: '30s', target: 500 }, // Spike to 500 users
    { duration: '1m', target: 50 },   // Back to normal
    { duration: '30s', target: 500 }, // Another spike
    { duration: '1m', target: 50 },   // Back to normal
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% of requests under 800ms
    http_req_failed: ['rate<0.15'],    // Error rate under 15%
  },
};

// Soak test configuration
export const soakTestOptions = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '1h', target: 100 },  // Sustained load
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% of requests under 400ms
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
  },
};
