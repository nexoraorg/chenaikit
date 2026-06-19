/**
 * Error scenario integration tests
 *
 * Validates that the API surfaces correct HTTP status codes and structured
 * error bodies across the most common failure modes.
 *
 * Notes on this codebase's routing:
 * - Account routes apply ValidationMiddleware BEFORE any auth check, so an
 *   invalid ID format returns 400, not 401/403.
 * - Account routes do NOT use the JWT `authenticate` middleware; they are
 *   publicly accessible (rate-limited only).
 * - The JWT `authenticate` middleware returns 401 (missing token) or 403
 *   (invalid/expired token). It is tested here via a mock route that mirrors
 *   its logic, and via the auth utility unit tests.
 */

import request from 'supertest';
import app from '../../index';
import { cleanDatabase, getTestPrisma } from '../setup';

const prisma = getTestPrisma();

describe('Error scenarios – integration', () => {
  beforeAll(async () => {
    await cleanDatabase(prisma);
  }, 30000);
  // ── 400 Bad Request ────────────────────────────────────────────────────────

  describe('400 Bad Request', () => {
    it('returns 400 for invalid register payload (bad email + short password)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'invalid', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBeDefined();
    });

    it('returns 400 for missing required fields on register', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid API version', async () => {
      const res = await request(app)
        .get('/api/credit-score')
        .set('Accept-Version', 'vXXX');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_API_VERSION');
    });

    it('returns 400 for account ID with invalid characters', async () => {
      // ValidationMiddleware.validateAccountId fires before any auth check
      const res = await request(app).get('/api/v1/accounts/invalid-id!');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ── 401 Unauthorized ───────────────────────────────────────────────────────

  describe('401 Unauthorized', () => {
    it('returns 401 for bad login credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'WrongPass123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('authenticate middleware returns 401 for missing Authorization header', async () => {
      // Verify the middleware logic directly — missing token → 401
      const { authenticate } = await import('../../middleware/auth');
      const mockReq: any = { headers: {} };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticate(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── 403 Forbidden ─────────────────────────────────────────────────────────

  describe('403 Forbidden', () => {
    it('authenticate middleware returns 403 for an invalid JWT', () => {
      const { authenticate } = require('../../middleware/auth');
      const mockReq: any = {
        headers: { authorization: 'Bearer bad.jwt.token' },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticate(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── 404 Not Found ─────────────────────────────────────────────────────────

  describe('404 Not Found', () => {
    it('returns 404 for completely unknown routes', async () => {
      const res = await request(app).get('/api/v1/no-such-endpoint-9999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ENDPOINT_NOT_FOUND');
    });

    it('returns 404 for unknown feature flag key', async () => {
      const res = await request(app).get('/api/v1/feature-flags/does-not-exist-xyz');
      expect(res.status).toBe(404);
    });

    it('returns 404 for valid account ID that has no record', async () => {
      // 56-char alphanumeric ID passes validation but is not in the in-memory store
      const validUnknownId = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB';
      const res = await request(app).get(`/api/v1/accounts/${validUnknownId}`);
      expect(res.status).toBe(404);
    });
  });

  // ── 409 Conflict ──────────────────────────────────────────────────────────

  describe('409 Conflict', () => {
    it('returns 409 when registering a duplicate email', async () => {
      const email = `conflict-${Date.now()}@example.com`;
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass123' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass123' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Structured error body ──────────────────────────────────────────────────

  describe('Error response shape', () => {
    it('error responses always include success:false, error.code, error.message, error.timestamp', async () => {
      const res = await request(app).get('/api/v1/completely-unknown-path');
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBeDefined();
      expect(res.body.error.message).toBeDefined();
      expect(res.body.error.timestamp).toBeDefined();
    });

    it('does not leak stack traces outside of development mode', async () => {
      // NODE_ENV is 'test', stack should be suppressed
      const res = await request(app).get('/api/v1/unknown-path');
      expect(res.body.error.stack).toBeUndefined();
    });
  });
});
