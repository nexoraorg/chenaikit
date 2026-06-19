/**
 * Feature Flags API integration tests
 *
 * Tests the full feature-flag CRUD and evaluation surface via the HTTP layer.
 * No mocks — the in-memory FeatureFlagService is exercised as-is.
 */

import request from 'supertest';
import app from '../../index';

const BASE_V1 = '/api/v1/feature-flags';

// Each test suite gets its own unique key prefix to avoid cross-test pollution
// in the in-memory store.
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createFlag(key: string, enabled = true) {
  return request(app)
    .post(BASE_V1)
    .send({ key, enabled, description: `Test flag ${key}` })
    .expect(201);
}

describe('Feature Flags API – integration', () => {
  // ── List flags ─────────────────────────────────────────────────────────────

  describe('GET /feature-flags', () => {
    it('returns 200 with a success wrapper and data array', async () => {
      const res = await request(app).get(BASE_V1);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── Create flag ────────────────────────────────────────────────────────────

  describe('POST /feature-flags', () => {
    it('creates a new flag and returns 201', async () => {
      const key = uid('create');
      const res = await createFlag(key);

      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toBe(key);
      expect(res.body.data.enabled).toBe(true);
    });

    it('returns 409 when the same key is created twice', async () => {
      const key = uid('dup');
      await createFlag(key);

      const res = await request(app)
        .post(BASE_V1)
        .send({ key, enabled: true });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('FLAG_ALREADY_EXISTS');
    });
  });

  // ── Get flag ───────────────────────────────────────────────────────────────

  describe('GET /feature-flags/:key', () => {
    it('returns the flag and its analytics', async () => {
      const key = uid('get');
      await createFlag(key);

      const res = await request(app).get(`${BASE_V1}/${key}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.flag.key).toBe(key);
      expect(res.body.data.analytics).toBeDefined();
    });

    it('returns 404 for a non-existent key', async () => {
      const res = await request(app).get(`${BASE_V1}/flag-does-not-exist`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FLAG_NOT_FOUND');
    });
  });

  // ── Update flag ────────────────────────────────────────────────────────────

  describe('PUT /feature-flags/:key', () => {
    it('updates flag fields', async () => {
      const key = uid('update');
      await createFlag(key, true);

      const res = await request(app)
        .put(`${BASE_V1}/${key}`)
        .send({ enabled: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(false);
    });

    it('returns 404 for a non-existent key', async () => {
      const res = await request(app)
        .put(`${BASE_V1}/nonexistent-flag`)
        .send({ enabled: false });

      expect(res.status).toBe(404);
    });
  });

  // ── Toggle flag ────────────────────────────────────────────────────────────

  describe('POST /feature-flags/:key/toggle', () => {
    it('toggles the enabled state', async () => {
      const key = uid('toggle');
      await createFlag(key, true);

      const toggledRes = await request(app).post(`${BASE_V1}/${key}/toggle`).expect(200);
      expect(toggledRes.body.data.enabled).toBe(false);

      const toggledBackRes = await request(app).post(`${BASE_V1}/${key}/toggle`).expect(200);
      expect(toggledBackRes.body.data.enabled).toBe(true);
    });
  });

  // ── Override ───────────────────────────────────────────────────────────────

  describe('Override management', () => {
    it('sets and clears an override', async () => {
      const key = uid('override');
      await createFlag(key, true);

      await request(app)
        .post(`${BASE_V1}/${key}/override`)
        .send({ value: false })
        .expect(200);

      await request(app)
        .delete(`${BASE_V1}/${key}/override`)
        .expect(200);
    });
  });

  // ── Delete flag ────────────────────────────────────────────────────────────

  describe('DELETE /feature-flags/:key', () => {
    it('deletes a flag and returns success', async () => {
      const key = uid('delete');
      await createFlag(key);

      await request(app).delete(`${BASE_V1}/${key}`).expect(200);

      // Confirm it is gone
      await request(app).get(`${BASE_V1}/${key}`).expect(404);
    });
  });

  // ── Evaluate flags ─────────────────────────────────────────────────────────

  describe('Evaluation endpoints', () => {
    it('GET /evaluate returns evaluation results', async () => {
      const res = await request(app).get(`${BASE_V1}/evaluate`).expect(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data).toBe('object');
    });

    it('POST /evaluate evaluates specific keys with context', async () => {
      const key = uid('eval');
      await createFlag(key, true);

      const res = await request(app)
        .post(`${BASE_V1}/evaluate`)
        .send({ keys: [key], context: { userId: 'test-user' } })
        .expect(200);

      expect(res.body.success).toBe(true);
      // Response is either an array of evaluation results or an object keyed by flag key
      const data = res.body.data;
      const hasFlag = Array.isArray(data)
        ? data.some((item: any) => item.flagKey === key)
        : Object.prototype.hasOwnProperty.call(data, key);
      expect(hasFlag).toBe(true);
    });
  });

  // ── Analytics & audit log ──────────────────────────────────────────────────

  describe('Analytics and audit log', () => {
    it('GET /analytics returns metrics and flag analytics', async () => {
      const res = await request(app).get(`${BASE_V1}/analytics`).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.flags).toBeDefined();
    });

    it('GET /audit-log returns an array', async () => {
      const res = await request(app).get(`${BASE_V1}/audit-log`).expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
