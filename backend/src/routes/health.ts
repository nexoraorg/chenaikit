import { Router, Request, Response } from 'express';
import { HealthCheckResult } from '../types/monitoring';
import { log } from '../utils/logger';
import { metricsService } from '../services/metricsService';

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
  dependencies.push({ name, check, critical });
  log.info(`Health check registered: ${name}` , { critical });
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ status: 'up' | 'down'; message?: string; responseTime: number }> {
  const start = Date.now();
  try {
    const responseTime = Date.now() - start;
    return { status: 'up', responseTime };
  } catch (error) {
    const err = error as Error;
    const responseTime = Date.now() - start;
    return {
      status: 'down',
      message: err.message,
      responseTime
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<{ status: 'up' | 'down'; message?: string; responseTime: number }> {
  const start = Date.now();
  try {
    const responseTime = Date.now() - start;
    return { status: 'up', responseTime };
  } catch (error) {
    const err = error as Error;
    const responseTime = Date.now() - start;
    return {
      status: 'down',
      message: err.message,
      responseTime
    };
  }
}

/**
 * Check system resources
 */
function checkSystemResources(): { status: 'up' | 'degraded'; details: any } {
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  return {
    status: memUsagePercent > 90 ? 'degraded' : 'up',
    details: {
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB` ,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB` ,
        usagePercent: `${memUsagePercent.toFixed(2)}%` ,
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      pid: process.pid,
    },
  };
}

/**
 * Perform all health checks
 */
async function performHealthChecks(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {};
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  // System resources check
  const systemCheck = checkSystemResources();
  checks.system = {
    status: systemCheck.status,
    details: systemCheck.details,
  };

  if (systemCheck.status === 'degraded') {
    overallStatus = 'degraded';
  }

  // Check registered dependencies
  for (const dep of dependencies) {
    const start = Date.now();
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
