/**
 * API Versioning middleware integration tests
 *
 * Exercises the three versioning strategies (URL path, Accept-Version header,
 * query parameter), deprecation / sunset policy, and version discovery.
 */

import request from 'supertest';
import app from '../../index';

describe('API Versioning – integration', () => {
  // ── Version via URL path ──────────────────────────────────────────────────

  describe('URL path versioning', () => {
    it('routes /api/v1/* correctly', async () => {
      const res = await request(app).get('/api/v1/credit-score');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('routes /api/v2/* correctly', async () => {
      const res = await request(app).get('/api/v2/credit-score');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('sets X-API-Version response header', async () => {
      const res = await request(app).get('/api/v1/credit-score');
      expect(res.headers['x-api-version'] || res.headers['x-chenaikit-api-version']).toBeDefined();
    });
  });

  // ── Version via Accept-Version header ─────────────────────────────────────

  describe('Accept-Version header versioning', () => {
    it('routes to v2 when Accept-Version: v2 is set', async () => {
      const res = await request(app)
        .get('/api/credit-score')
        .set('Accept-Version', 'v2');

      expect(res.status).toBe(200);
      // v2 wraps result in { creditScore: { ... } }
      expect(res.body.data).toHaveProperty('creditScore');
    });

    it('routes to v1 when Accept-Version: v1 is set', async () => {
      const res = await request(app)
        .get('/api/credit-score')
        .set('Accept-Version', 'v1');

      expect(res.status).toBe(200);
      // v1 uses a flat { score, factors } shape
      expect(res.body.data).toHaveProperty('score');
    });
  });

  // ── Version via query parameter ───────────────────────────────────────────

  describe('Query parameter versioning', () => {
    it('respects ?version=v2', async () => {
      const res = await request(app).get('/api/credit-score?version=v2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('creditScore');
    });

    it('respects ?v=v1', async () => {
      const res = await request(app).get('/api/credit-score?v=v1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('score');
    });
  });

  // ── Unsupported version ───────────────────────────────────────────────────

  describe('Unsupported version', () => {
    it('returns 400 for unknown version in URL path', async () => {
      const res = await request(app).get('/api/v99/credit-score');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_API_VERSION');
    });

    it('returns 400 for unknown version in header', async () => {
      const res = await request(app)
        .get('/api/credit-score')
        .set('Accept-Version', 'v99');
      expect(res.status).toBe(400);
    });
  });

  // ── v1 vs v2 response shape differences ──────────────────────────────────

  describe('Response shape per version', () => {
    it('v1 /credit-score returns flat shape', async () => {
      const res = await request(app).get('/api/v1/credit-score').expect(200);
      const data = res.body.data;
      expect(data).toHaveProperty('score');
      expect(data).toHaveProperty('factors');
    });

    it('v2 /credit-score returns nested shape', async () => {
      const res = await request(app).get('/api/v2/credit-score').expect(200);
      const data = res.body.data;
      expect(data).toHaveProperty('creditScore');
      expect(data.creditScore).toHaveProperty('value');
    });

    it('v1 /fraud/detect returns flat shape', async () => {
      const res = await request(app).get('/api/v1/fraud/detect').expect(200);
      const data = res.body.data;
      expect(data).toHaveProperty('riskScore');
    });

    it('v2 /fraud/detect returns nested shape with meta', async () => {
      const res = await request(app).get('/api/v2/fraud/detect').expect(200);
      const data = res.body.data;
      expect(data).toHaveProperty('fraud');
      expect(data).toHaveProperty('meta');
    });
  });

  // ── Not-found fallback ────────────────────────────────────────────────────

  describe('404 fallback', () => {
    it('returns 404 with ENDPOINT_NOT_FOUND for unknown paths', async () => {
      const res = await request(app).get('/api/v1/does-not-exist-xyz');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ENDPOINT_NOT_FOUND');
    });
  });
});
