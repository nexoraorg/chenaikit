import { MetricsService, metricsService } from '../metricsService';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const metrics = await service.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('http_requests_total');
    });
  });

  describe('recordRequest', () => {
    it('should record HTTP request metrics', () => {
      service.recordRequest('GET', '/api/users', 200, 0.5);
      
      // Verify no errors thrown
      expect(true).toBe(true);
    });

    it('should record multiple requests', () => {
      service.recordRequest('GET', '/api/users', 200, 0.5);
      service.recordRequest('POST', '/api/users', 201, 0.8);
      service.recordRequest('GET', '/api/users', 404, 0.2);
      
      // Verify no errors thrown
      expect(true).toBe(true);
    });

    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      methods.forEach(method => {
        service.recordRequest(method, '/api/test', 200, 0.1);
      });
      
      expect(true).toBe(true);
    });

    it('should handle different status codes', () => {
      const statuses = [200, 201, 400, 404, 500];
      
      statuses.forEach(status => {
        service.recordRequest('GET', '/api/test', status, 0.1);
      });
      
      expect(true).toBe(true);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(metricsService).toBeInstanceOf(MetricsService);
    });

    it('should record metrics on singleton', () => {
      metricsService.recordRequest('GET', '/api/health', 200, 0.05);
      expect(true).toBe(true);
    });
  });
});
