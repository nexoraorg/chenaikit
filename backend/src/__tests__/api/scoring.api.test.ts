/**
 * Scoring API integration tests
 *
 * Covers /credit-score and /fraud/detect across v1 and v2,
 * validating response shapes, versioning headers, and non-auth access.
 */

import request from 'supertest';
import app from '../../index';

describe('Scoring API – integration', () => {
  // ── Credit Score ───────────────────────────────────────────────────────────

  describe('GET /credit-score', () => {
    it('v1: returns flat shape with score, factors, timestamp', async () => {
      const res = await request(app).get('/api/v1/credit-score').expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(typeof data.score).toBe('number');
      expect(data.score).toBeGreaterThanOrEqual(150);
      expect(data.score).toBeLessThanOrEqual(1000);
      expect(Array.isArray(data.factors)).toBe(true);
      expect(typeof data.timestamp).toBe('string');
    });

    it('v2: returns nested shape with creditScore.value and meta', async () => {
      const res = await request(app).get('/api/v2/credit-score').expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.creditScore).toBeDefined();
      expect(typeof data.creditScore.value).toBe('number');
      expect(['excellent', 'fair', 'poor']).toContain(data.creditScore.band);
      expect(Array.isArray(data.creditScore.factors)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(data.meta.model).toBe('credit-score-v2');
    });

    it('v1 shape does NOT include creditScore nested key', async () => {
      const res = await request(app).get('/api/v1/credit-score').expect(200);
      expect(res.body.data.creditScore).toBeUndefined();
    });

    it('v2 shape does NOT include flat score key at top level', async () => {
      const res = await request(app).get('/api/v2/credit-score').expect(200);
      expect(res.body.data.score).toBeUndefined();
    });

    it('responds consistently on multiple calls (no state leak)', async () => {
      const [r1, r2] = await Promise.all([
        request(app).get('/api/v1/credit-score'),
        request(app).get('/api/v1/credit-score'),
      ]);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      // Both calls return valid scores (may differ — they are random)
      expect(r1.body.data.score).toBeGreaterThan(0);
      expect(r2.body.data.score).toBeGreaterThan(0);
    });
  });

  // ── Fraud Detection ────────────────────────────────────────────────────────

  describe('GET /fraud/detect', () => {
    it('v1: returns flat shape with riskScore, riskLevel, factors, timestamp', async () => {
      const res = await request(app).get('/api/v1/fraud/detect').expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(typeof data.riskScore).toBe('number');
      expect(data.riskScore).toBeGreaterThanOrEqual(0);
      expect(data.riskScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high']).toContain(data.riskLevel);
      expect(Array.isArray(data.factors)).toBe(true);
      expect(typeof data.timestamp).toBe('string');
    });

    it('v2: returns nested shape with fraud.riskScore and meta.model', async () => {
      const res = await request(app).get('/api/v2/fraud/detect').expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.fraud).toBeDefined();
      expect(typeof data.fraud.riskScore).toBe('number');
      expect(['low', 'medium', 'high']).toContain(data.fraud.riskLevel);
      expect(Array.isArray(data.fraud.factors)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(data.meta.model).toBe('fraud-detect-v2');
    });

    it('v1 shape does NOT include fraud nested key', async () => {
      const res = await request(app).get('/api/v1/fraud/detect').expect(200);
      expect(res.body.data.fraud).toBeUndefined();
    });

    it('v2 shape does NOT include flat riskScore at data top level', async () => {
      const res = await request(app).get('/api/v2/fraud/detect').expect(200);
      expect(res.body.data.riskScore).toBeUndefined();
    });

    it('version header strategy returns correct shape', async () => {
      const v1Res = await request(app)
        .get('/api/fraud/detect')
        .set('Accept-Version', 'v1')
        .expect(200);

      const v2Res = await request(app)
        .get('/api/fraud/detect')
        .set('Accept-Version', 'v2')
        .expect(200);

      // v1: flat shape has riskScore at top level
      expect(v1Res.body.data.riskScore).toBeDefined();
      // v2: nested shape has fraud object
      expect(v2Res.body.data.fraud).toBeDefined();
    });
  });
});
