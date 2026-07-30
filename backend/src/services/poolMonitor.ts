import { PrismaClient } from '@prisma/client';
import { PoolUtils } from '../utils/poolUtils';
import { dbConfig } from '../config/database';

export class PoolMonitor {
  private timer: NodeJS.Timeout | null = null;
  private prisma: PrismaClient;
  private consecutiveFailures: number = 0;
  private readonly MAX_FAILURES = 3;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  start() {
    if (!dbConfig.monitoring.enabled) return;
    
    console.log(`Starting DB pool monitor with interval ${dbConfig.monitoring.intervalMs}ms`);
    this.timer = setInterval(async () => {
      await this.checkHealth();
    }, dbConfig.monitoring.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkHealth() {
    const isHealthy = await PoolUtils.checkConnection(this.prisma);
    
    if (!isHealthy) {
      this.consecutiveFailures++;
      console.warn(`ALERT: DB connection pool health check failed. (${this.consecutiveFailures}/${this.MAX_FAILURES})`);
      
      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        console.error('CRITICAL: Connection leak detected or DB is down. Attempting pool recreation...');
        await PoolUtils.recreatePool(this.prisma);
        this.consecutiveFailures = 0; // Reset after recreation attempt
      }
    } else {
      this.consecutiveFailures = 0;
      
      // Attempt to read Prisma metrics if the preview feature is enabled
      try {
        const metrics = await this.prisma.$metrics.json();
        const queries = metrics.counters.find((c: any) => c.name === 'prisma_client_queries_total');
        const activeConnections = metrics.gauges.find((g: any) => g.name === 'prisma_pool_connections_busy');
        const idleConnections = metrics.gauges.find((g: any) => g.name === 'prisma_pool_connections_idle');
        const waitTime = metrics.histograms.find((h: any) => h.name === 'prisma_client_queries_wait');
        
        console.log(`[DB Pool Metrics] Queries: ${queries?.value ?? 0} | Active: ${activeConnections?.value ?? 0} | Idle: ${idleConnections?.value ?? 0}`);
        
      } catch (e) {
        // Metrics not enabled or failed to fetch
      }
    }
  }
}
