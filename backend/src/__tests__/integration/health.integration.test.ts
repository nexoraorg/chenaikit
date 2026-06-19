/**
 * Health endpoint integration tests
 *
 * Verifies that the three health routes respond with correct status codes
 * and response shapes without mocking any dependencies.
 */

import request from 'supertest';
import app from '../../index';

describe('Health endpoints – integration', () => {
  // ── GET /api/health ─────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('responds with 200 or 207', async () => {
      const res = await request(app).get('/api/health');
      expect([200, 207]).toContain(res.status);
    });

    it('returns a status field of healthy or degraded', async () => {
      const res = await request(app).get('/api/health');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.status);
    });

    it('includes uptime and timestamp fields', async () => {
      const res = await request(app).get('/api/health');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('includes a checks object', async () => {
      const res = await request(app).get('/api/health');
      expect(res.body.checks).toBeDefined();
      expect(typeof res.body.checks).toBe('object');
    });
  });

  // ── GET /api/health/liveness ─────────────────────────────────────────────

  describe('GET /api/health/liveness', () => {
    it('always returns 200', async () => {
      const res = await request(app).get('/api/health/liveness');
      expect(res.status).toBe(200);
    });

    it('returns { status: "alive" }', async () => {
      const res = await request(app).get('/api/health/liveness');
      expect(res.body).toEqual({ status: 'alive' });
    });
  });

  // ── GET /api/health/readiness ────────────────────────────────────────────

  describe('GET /api/health/readiness', () => {
    it('responds with 200 or 503', async () => {
      const res = await request(app).get('/api/health/readiness');
      expect([200, 503]).toContain(res.status);
    });

    it('includes a status field', async () => {
      const res = await request(app).get('/api/health/readiness');
      expect(res.body.status).toBeDefined();
    });
  });

  // ── GET /api/versions ────────────────────────────────────────────────────

  describe('GET /api/versions', () => {
    it('returns 200 with version metadata', async () => {
      const res = await request(app).get('/api/versions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.default).toBeDefined();
      expect(res.body.data.latest).toBeDefined();
      expect(Array.isArray(res.body.data.versions) || typeof res.body.data.versions === 'object').toBe(true);
    });
  });

  // ── GET /metrics ─────────────────────────────────────────────────────────

  describe('GET /metrics', () => {
    it('returns Prometheus-format text with 200', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/# HELP|# TYPE/);
    });
  });
});
