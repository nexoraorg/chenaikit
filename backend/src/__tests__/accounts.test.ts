import request from 'supertest';
import app from '../index';

describe('Account API Endpoints', () => {
  const mockAccountId = 'GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK';
  const validAccount = {
    name: 'Test User',
    email: 'test@example.com',
    publicKey: 'GNEWPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  };

  describe('GET /api/accounts/:id', () => {
    it('should return account details for valid account ID', async () => {
      const response = await request(app)
        .get(`/api/accounts/${mockAccountId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', mockAccountId);
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('balance');
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/api/accounts/GNONEXISTENT123456789')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'ACCOUNT_NOT_FOUND');
    });

    it('should return 400 for invalid account ID format', async () => {
      const response = await request(app)
        .get('/api/accounts/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/accounts/:id/balance', () => {
    it('should return balance for valid account ID', async () => {
      const response = await request(app)
        .get(`/api/accounts/${mockAccountId}/balance`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('balance');
      expect(response.body.data).toHaveProperty('accountId', mockAccountId);
      expect(typeof response.body.data.balance).toBe('number');
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/api/accounts/GNONEXISTENT123456789/balance')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'ACCOUNT_NOT_FOUND');
    });
  });

  describe('GET /api/accounts/:id/transactions', () => {
    it('should return transactions with default pagination', async () => {
      const response = await request(app)
        .get(`/api/accounts/${mockAccountId}/transactions`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.data)).toBe(true);

      const pagination = response.body.data.pagination;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('pages');
      expect(pagination).toHaveProperty('hasNext');
      expect(pagination).toHaveProperty('hasPrev');
    });

    it('should return transactions with custom pagination', async () => {
      const response = await request(app)
        .get(`/api/accounts/${mockAccountId}/transactions?page=1&limit=5&sortBy=amount&sortOrder=asc`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.page).toBe(1);
    });

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/accounts/${mockAccountId}/transactions?page=0&limit=101`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/accounts', () => {
    it('should create a new account with valid data', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send(validAccount)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', validAccount.publicKey);
      expect(response.body.data).toHaveProperty('name', validAccount.name);
      expect(response.body.data).toHaveProperty('email', validAccount.email);
      expect(response.body.data).toHaveProperty('balance', 0);
      expect(response.body.data).toHaveProperty('isActive', true);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send({ name: 'Test User' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error).toHaveProperty('details');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send({
          ...validAccount,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 for invalid public key format', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send({
          ...validAccount,
          publicKey: 'invalid-key'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 409 for duplicate public key', async () => {
      // First creation should succeed
      await request(app)
        .post('/api/accounts')
        .send({
          ...validAccount,
          publicKey: 'GDUPLICATE123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        })
        .expect(201);

      // Second creation with same public key should fail
      const response = await request(app)
        .post('/api/accounts')
        .send({
          ...validAccount,
          publicKey: 'GDUPLICATE123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        })
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'ACCOUNT_ALREADY_EXISTS');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to account creation', async () => {
      const requests = [];

      // Make multiple requests quickly
      for (let i = 0; i < 7; i++) {
        requests.push(
          request(app)
            .post('/api/accounts')
            .send({
              ...validAccount,
              publicKey: `GTEST${i}123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`
            })
        );
      }

      const responses = await Promise.all(requests);

      // Should have at least one rate-limited response
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'ENDPOINT_NOT_FOUND');
    });

    it('should include proper error timestamps', async () => {
      const response = await request(app)
        .get('/api/accounts/invalid-id')
        .expect(400);

      expect(response.body.error).toHaveProperty('timestamp');
      expect(new Date(response.body.error.timestamp)).toBeInstanceOf(Date);
    });
  });
});