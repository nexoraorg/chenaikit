import axios from 'axios';
import { createTestAccount, TestAccount } from './helpers/setup';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

describe('API Integration Tests', () => {
  let authToken: string;
  let testAccount: TestAccount;

  beforeAll(async () => {
    testAccount = await createTestAccount();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/health`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
    });
  });

  describe('Authentication', () => {
    it('should register new user', async () => {
      const userData = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      };

      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('token');
      authToken = response.data.token;
    });

    it('should login existing user', async () => {
      const credentials = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      };

      // Register first
      await axios.post(`${API_BASE_URL}/api/auth/register`, credentials);

      // Then login
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, credentials);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('token');
    });

    it('should reject invalid credentials', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };

      await expect(
        axios.post(`${API_BASE_URL}/api/auth/login`, credentials)
      ).rejects.toThrow();
    });
  });

  describe('Account Operations', () => {
    beforeAll(async () => {
      // Get auth token
      const userData = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      };
      const authResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      authToken = authResponse.data.token;
    });

    it('should get account information', async () => {
      const response = await axios.get(
        `${API_BASE_URL}/api/accounts/${testAccount.publicKey}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('account');
    });

    it('should require authentication', async () => {
      await expect(
        axios.get(`${API_BASE_URL}/api/accounts/${testAccount.publicKey}`)
      ).rejects.toThrow();
    });
  });

  describe('Credit Score API', () => {
    beforeAll(async () => {
      const userData = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      };
      const authResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      authToken = authResponse.data.token;
    });

    it('should calculate credit score', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/credit-score`,
        {
          accountId: testAccount.publicKey
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data.data).toHaveProperty('score');
    });
  });

  describe('Fraud Detection API', () => {
    beforeAll(async () => {
      const userData = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      };
      const authResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      authToken = authResponse.data.token;
    });

    it('should detect fraud in transaction', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/fraud/detect`,
        {
          transaction: {
            sourceAccount: testAccount.publicKey,
            amount: '100',
            destination: 'GDEST...'
          }
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data.data).toHaveProperty('riskScore');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const userData = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      };
      const authResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      const token = authResponse.data.token;

      // Make multiple rapid requests
      const requests = Array.from({ length: 100 }, () =>
        axios.get(`${API_BASE_URL}/api/health`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => err.response)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r?.status === 429);

      expect(rateLimited).toBe(true);
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      await expect(
        axios.get(`${API_BASE_URL}/api/nonexistent`)
      ).rejects.toMatchObject({
        response: { status: 404 }
      });
    });

    it('should validate request body', async () => {
      const userData = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      };
      const authResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      const token = authResponse.data.token;

      await expect(
        axios.post(
          `${API_BASE_URL}/api/v1/credit-score`,
          { invalid: 'data' },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ).rejects.toThrow();
    });
  });
});
