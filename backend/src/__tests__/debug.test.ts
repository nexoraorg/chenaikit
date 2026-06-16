import request from 'supertest';
import app from '../index';

describe('Debug Analytics API', () => {
  it('should see why export fails', async () => {
    const response = await request(app)
      .get('/api/v1/analytics/dashboard')
      .query({ days: 30 });

    console.log('DEBUG Response Status:', response.status);
    console.log('DEBUG Response Body:', JSON.stringify(response.body, null, 2));
    
    expect(response.status).toBe(200);
  }, 30000);
});
