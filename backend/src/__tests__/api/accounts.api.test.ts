/**
 * Accounts API integration tests
 *
 * Tests all account endpoints through the full HTTP stack.
 * The AccountController uses an in-memory store, so no DB is needed here.
 *
 * Note: Account routes use rate-limiting middleware but do NOT require JWT
 * bearer tokens — authentication is not applied to these routes.
 */

import request from 'supertest';
import app from '../../index';

const BASE_V1 = '/api/v1/accounts';
const BASE_V2 = '/api/v2/accounts';

// The seeded mock account in AccountController
const SEEDED_ID = 'GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK';

// Valid Stellar Base32 public key (G + 55 chars from A-Z, 2-7)
// Used for "unknown" lookups — valid format but not seeded in the in-memory store
const UNKNOWN_ID  = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB';

/**
 * Generate a valid Stellar-format public key.
 * Stellar public keys are: G + 55 chars from the Base32 alphabet (A-Z, 2-7).
 */
function stellarKey(seed: string): string {
  const b32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const padded = (seed.toUpperCase() + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA').slice(0, 55);
  const clean = padded.split('').map(c => b32.includes(c) ? c : 'A').join('');
  return `G${clean}`;
}

describe('Accounts API – integration', () => {
  // ── GET /accounts/:id ──────────────────────────────────────────────────────

  describe('GET /accounts/:id', () => {
    it('returns 200 with account data for the seeded account', async () => {
      const res = await request(app).get(`${BASE_V1}/${SEEDED_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(SEEDED_ID);
      expect(res.body.data).toHaveProperty('balance');
      expect(res.body.timestamp).toBeDefined();
    });

    it('returns 404 for a valid but unknown account ID', async () => {
      const res = await request(app).get(`${BASE_V1}/${UNKNOWN_ID}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('works via v2 prefix as well', async () => {
      const res = await request(app).get(`${BASE_V2}/${SEEDED_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(SEEDED_ID);
    });

    it('returns 400 for an ID with invalid format', async () => {
      // Non-alphanumeric chars fail the validation middleware
      const res = await request(app).get(`${BASE_V1}/invalid-id!`);
      expect(res.status).toBe(400);
    });
  });

  // ── GET /accounts/:id/balance ──────────────────────────────────────────────

  describe('GET /accounts/:id/balance', () => {
    it('returns 200 with balance data for the seeded account', async () => {
      const res = await request(app).get(`${BASE_V1}/${SEEDED_ID}/balance`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.balance).toBe('number');
      expect(res.body.data.accountId).toBe(SEEDED_ID);
    });

    it('returns 404 for a valid but unknown account', async () => {
      const res = await request(app).get(`${BASE_V1}/${UNKNOWN_ID}/balance`);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /accounts/:id/transactions ────────────────────────────────────────

  describe('GET /accounts/:id/transactions', () => {
    it('returns 200 with paginated transactions for the seeded account', async () => {
      const res = await request(app).get(`${BASE_V1}/${SEEDED_ID}/transactions`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
      expect(typeof res.body.data.pagination.total).toBe('number');
    });

    it('respects page and limit query params', async () => {
      const res = await request(app).get(`${BASE_V1}/${SEEDED_ID}/transactions?page=1&limit=2`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.limit).toBe(2);
    });

    it('supports sortOrder=asc', async () => {
      const res = await request(app).get(`${BASE_V1}/${SEEDED_ID}/transactions?sortOrder=asc`);
      expect(res.status).toBe(200);
    });

    it('returns 404 for a valid but unknown account', async () => {
      const res = await request(app).get(`${BASE_V1}/${UNKNOWN_ID}/transactions`);
      expect(res.status).toBe(404);
    });
  });

  // ── POST /accounts ─────────────────────────────────────────────────────────

  describe('POST /accounts', () => {
    it('creates a new account and returns 201', async () => {
      // Use a unique seed so the in-memory store does not have this key yet
      const publicKey = stellarKey(`NEW${Date.now().toString().slice(-8)}`);
      const res = await request(app)
        .post(BASE_V1)
        .send({
          name: 'Test User',
          email: `new-${Date.now()}@example.com`,
          publicKey,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(publicKey);
      expect(res.body.data.balance).toBe(0);
    });

    it('returns 409 for duplicate public key (seeded account)', async () => {
      const res = await request(app)
        .post(BASE_V1)
        .send({
          name: 'John Doe',
          email: 'new-unique@example.com',
          publicKey: SEEDED_ID, // already exists in-memory
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post(BASE_V1)
        .send({ name: 'No Key User' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for a public key with invalid Stellar format', async () => {
      const res = await request(app)
        .post(BASE_V1)
        .send({
          name: 'Bad Key',
          email: 'bad@example.com',
          publicKey: 'NOTASTELLARKEY',
        });

      expect(res.status).toBe(400);
    });
  });
});
