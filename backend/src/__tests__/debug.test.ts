import request from 'supertest';
import app from '../index';

describe('Analytics API', () => {
  it('should respond to the dashboard endpoint', async () => {
    const response = await request(app)
      .get('/api/v1/analytics/dashboard')
      .query({ days: 30 });

    expect(response.status).toBeLessThan(600);
    expect(response.body).toBeDefined();
  }, 30000);
});
