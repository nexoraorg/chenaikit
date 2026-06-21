import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

export class MetricsService {
  private registry: Registry;
  private requestCounter: Counter;
  private requestDuration: Histogram;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({
      app: 'chenaikit-backend'
    });

    collectDefaultMetrics({ register: this.registry });

    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry]
    });

    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });
  }

  getMetrics() {
    return this.registry.metrics();
  }

  recordRequest(method: string, route: string, status: number, duration: number) {
    const labels = { method, route, status: status.toString() };
    this.requestCounter.inc(labels);
    this.requestDuration.observe(labels, duration);
  }
}

export const metricsService = new MetricsService();

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    metricsService.recordRequest(req.method, route, res.statusCode, duration);
  });
  next();
};
