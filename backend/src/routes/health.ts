import { Router, Request, Response } from 'express';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: Record<string, ServiceHealth>;
}

interface ServiceHealth {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}

const healthChecks: Record<string, () => Promise<ServiceHealth>> = {};

export function registerHealthCheck(
  name: string,
  check: () => Promise<ServiceHealth>
): void {
  healthChecks[name] = check;
}

router.get('/health', async (req: Request, res: Response) => {
  const results: Record<string, ServiceHealth> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  for (const [name, check] of Object.entries(healthChecks)) {
    try {
      const start = Date.now();
      results[name] = await Promise.race([
        check(),
        new Promise<ServiceHealth>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);
      results[name].responseTime = Date.now() - start;
    } catch (error) {
      results[name] = {
        status: 'down',
        error: (error as Error).message
      };
      overallStatus = 'unhealthy';
    }
  }

  const downServices = Object.values(results).filter(s => s.status === 'down').length;
  if (downServices > 0 && downServices < Object.keys(results).length) {
    overallStatus = 'degraded';
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: results
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;
  res.status(statusCode).json(response);
});

router.get('/health/liveness', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

router.get('/health/readiness', async (req: Request, res: Response) => {
  const criticalServices = ['database', 'stellar'];
  const results: Record<string, ServiceHealth> = {};

  for (const name of criticalServices) {
    if (healthChecks[name]) {
      try {
        results[name] = await healthChecks[name]();
      } catch (error) {
        return res.status(503).json({ status: 'not ready', error: (error as Error).message });
      }
    }
  }

  const allUp = Object.values(results).every(s => s.status === 'up');
  res.status(allUp ? 200 : 503).json({ status: allUp ? 'ready' : 'not ready', services: results });
});

export default router;
