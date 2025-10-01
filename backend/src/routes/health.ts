import { Router, Request, Response } from 'express';
import { HealthCheckResult } from '../types/monitoring';
import { monitoringConfig } from '../config/monitoring';
import { log } from '../utils/logger';
import { metricsService } from '../services/metricsService';

const router: Router = Router();

// Store application start time
const startTime = Date.now();

// Health check dependencies
interface HealthCheckDependency {
  name: string;
  check: () => Promise<{ status: 'up' | 'down' | 'degraded'; message?: string; details?: any }>;
  critical: boolean;
}

const dependencies: HealthCheckDependency[] = [];

/**
 * Register a health check dependency
 */
export function registerHealthCheck(
  name: string,
  check: () => Promise<{ status: 'up' | 'down' | 'degraded'; message?: string; details?: any }>,
  critical: boolean = true
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
  } catch (error: any) {
    const responseTime = Date.now() - start;
    return {
      status: 'down',
      message: error.message,
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
  } catch (error: any) {
    const responseTime = Date.now() - start;
    return {
      status: 'down',
      message: error.message,
      responseTime
    };
  }
}

/**
 * Check external API connectivity
 */
async function checkExternalAPI(name: string, url: string): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - start;

    if (response.ok) {
      return { status: 'up', responseTime };
    } else if (responseTime > 2000) {
      return { status: 'degraded', responseTime };
    } else {
      return { status: 'down', responseTime };
    }
  } catch (error: any) {
    const responseTime = Date.now() - start;
    return { status: 'down', responseTime };
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
      const result = await Promise.race([
        dep.check(),
        new Promise<{ status: 'down'; message: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        ),
      ]) as { status: 'up' | 'down' | 'degraded'; message?: string; details?: any };

      const responseTime = Date.now() - start;
      checks[dep.name] = {
        status: result.status,
        message: result.message,
        responseTime,
        ...(result.details && { details: result.details }),
      };

      // Update overall status
      if (dep.critical && result.status === 'down') {
        overallStatus = 'unhealthy';
      } else if (result.status === 'degraded' && overallStatus !== 'unhealthy') {
        overallStatus = 'degraded';
      }
    } catch (error: any) {
      const responseTime = Date.now() - start;
      checks[dep.name] = {
        status: 'down',
        message: error.message,
        responseTime,
      };

      if (dep.critical) {
        overallStatus = 'unhealthy';
      }
    }
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}

/**
 * GET /health - Basic health check
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await performHealthChecks();
    const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(result);
  } catch (error: any) {
    log.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /health/live - Liveness probe (Kubernetes)
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

/**
 * GET /health/ready - Readiness probe (Kubernetes)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const result = await performHealthChecks();
    if (result.status === 'unhealthy') {
      return res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: result.checks,
      });
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: result.checks,
    });
  } catch (error: any) {
    log.error('Readiness check failed', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /health/metrics - Prometheus metrics endpoint
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error: any) {
    log.error('Failed to retrieve metrics', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /health/stats - Performance statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const operation = req.query.operation as string | undefined;
    const stats = { message: 'Performance stats not yet implemented' };

    res.json({
      timestamp: new Date().toISOString(),
      stats: stats || { message: 'No performance data available' },
      operations: operation ? undefined : ['database', 'redis'],
    });
  } catch (error: any) {
    log.error('Failed to retrieve stats', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

/**
 * GET /health/info - Application information
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    application: {
      name: 'chenaikit-backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    },
    timestamp: new Date().toISOString(),
  });
});

// Register default health checks
registerHealthCheck('database', checkDatabase, true);
registerHealthCheck('redis', checkRedis, false);

export default router;
