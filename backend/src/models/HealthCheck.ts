export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type CheckStatus = 'up' | 'degraded' | 'down';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type TrendDirection = 'improving' | 'stable' | 'degrading';

// ---------------------------------------------------------------------------
// Individual check result
// ---------------------------------------------------------------------------

export interface CheckResult {
  status: CheckStatus;
  responseTimeMs: number;
  message?: string;
  details?: Record<string, unknown>;
  checkedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// System resource snapshots
// ---------------------------------------------------------------------------

export interface MemorySnapshot {
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  rssMb: number;
  usagePercent: number;
}

export interface CpuSnapshot {
  usagePercent: number;
  userMs: number;
  systemMs: number;
  loadAvg1m: number;
  loadAvg5m: number;
  loadAvg15m: number;
}

export interface DiskSnapshot {
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usagePercent: number;
  path: string;
}

// ---------------------------------------------------------------------------
// Full health check snapshot
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  id: string;
  status: HealthStatus;
  score: number; // 0–100
  timestamp: string; // ISO-8601
  uptimeSeconds: number;
  checks: {
    database?: CheckResult;
    redis?: CheckResult;
    memory?: CheckResult & { snapshot?: MemorySnapshot };
    cpu?: CheckResult & { snapshot?: CpuSnapshot };
    disk?: CheckResult & { snapshot?: DiskSnapshot };
    [externalService: string]: CheckResult | undefined;
  };
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Health history
// ---------------------------------------------------------------------------

export interface HealthHistoryEntry {
  id: string;
  status: HealthStatus;
  score: number;
  timestamp: string;
  durationMs: number; // time to run all checks
}

export interface HealthHistory {
  entries: HealthHistoryEntry[];
  totalEntries: number;
  oldestEntry?: string; // ISO-8601 timestamp
  newestEntry?: string;
}

// ---------------------------------------------------------------------------
// Health trends
// ---------------------------------------------------------------------------

export interface HealthTrend {
  direction: TrendDirection;
  scoreChange: number; // positive = improving, negative = degrading
  windowEntries: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  percentageHealthy: number;
  percentageDegraded: number;
  percentageUnhealthy: number;
}

// ---------------------------------------------------------------------------
// Health score breakdown
// ---------------------------------------------------------------------------

export interface HealthScoreBreakdown {
  total: number; // 0–100
  components: {
    name: string;
    weight: number; // 0–1
    rawScore: number; // 0–100
    weightedScore: number;
  }[];
}

// ---------------------------------------------------------------------------
// Health alerts
// ---------------------------------------------------------------------------

export interface HealthAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  checkName: string;
  currentScore: number;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Health report (aggregated for dashboards / CI)
// ---------------------------------------------------------------------------

export interface HealthReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  overallStatus: HealthStatus;
  averageScore: number;
  trend: HealthTrend;
  checkSummary: Record<
    string,
    {
      totalChecks: number;
      upCount: number;
      degradedCount: number;
      downCount: number;
      avgResponseTimeMs: number;
      availability: number; // 0–1
    }
  >;
  alerts: HealthAlert[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// HealthCheck plain class — wraps a snapshot and exposes helpers
// ---------------------------------------------------------------------------

export class HealthCheck {
  constructor(public readonly snapshot: HealthSnapshot) {}

  get id(): string {
    return this.snapshot.id;
  }

  get status(): HealthStatus {
    return this.snapshot.status;
  }

  get score(): number {
    return this.snapshot.score;
  }

  get timestamp(): string {
    return this.snapshot.timestamp;
  }

  isHealthy(): boolean {
    return this.snapshot.status === 'healthy';
  }

  isDegraded(): boolean {
    return this.snapshot.status === 'degraded';
  }

  isUnhealthy(): boolean {
    return this.snapshot.status === 'unhealthy';
  }

  /** HTTP status code suitable for responding to load-balancer / k8s probes */
  httpStatusCode(): number {
    switch (this.snapshot.status) {
      case 'healthy':
        return 200;
      case 'degraded':
        return 207;
      case 'unhealthy':
        return 503;
    }
  }

  /** Convert to a plain JSON-serialisable object */
  toJSON(): HealthSnapshot {
    return this.snapshot;
  }

  /** Build a HealthCheck from a raw snapshot object */
  static fromSnapshot(snapshot: HealthSnapshot): HealthCheck {
    return new HealthCheck(snapshot);
  }

  /** Build a minimal HealthHistoryEntry from this snapshot */
  toHistoryEntry(durationMs: number): HealthHistoryEntry {
    return {
      id: this.snapshot.id,
      status: this.snapshot.status,
      score: this.snapshot.score,
      timestamp: this.snapshot.timestamp,
      durationMs,
    };
  }
}
