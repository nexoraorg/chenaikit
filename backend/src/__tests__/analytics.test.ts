import request from 'supertest';
import app from '../index';

describe('Analytics API', () => {
  describe('GET /api/v1/analytics/dashboard', () => {
    it('should return dashboard summary statistics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('systemUsage');
      expect(response.body.data).toHaveProperty('aiPerformance');
      expect(response.body.data).toHaveProperty('blockchainActivity');
    });
  });

  describe('GET /api/v1/analytics/trends', () => {
    it('should return traffic trends and forecast', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/trends')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('history');
      expect(response.body.data).toHaveProperty('forecast');
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/export', () => {
    it('should allow CSV export', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/export')
        .query({ format: 'csv', type: 'usage' });

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('text/csv');
      expect(response.header['content-disposition']).toContain('attachment');
    });

    it('should allow PDF export', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/export')
        .query({ format: 'pdf', type: 'usage' });

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('application/pdf');
    });
  });
});
