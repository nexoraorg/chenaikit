// Core monitoring interfaces
export interface MonitoringConfig {
  horizonUrl: string;
  network: 'testnet' | 'mainnet';
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  batchSize?: number;
  alertThresholds?: AlertThresholds;
  filters?: TransactionFilterConfig;
}

export interface AlertThresholds {
  highVolumeAmount: number;
  rapidTransactionCount: number;
  rapidTransactionWindow: number; // in milliseconds
  suspiciousPatternScore: number;
}

export interface TransactionFilterConfig {
  accounts?: string[];
  assets?: string[];
  minAmount?: number;
  maxAmount?: number;
  operations?: string[];
  excludeAccounts?: string[];
}

// Transaction and event types
export interface TransactionEvent {
  id: string;
  hash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  fee: string;
  operationCount: number;
  operations: OperationEvent[];
  successful: boolean;
  memo?: string;
  timeBounds?: {
    minTime: string;
    maxTime: string;
  };
}

export interface OperationEvent {
  id: string;
  type: string;
  sourceAccount?: string;
  destination?: string;
  asset?: {
    type: string;
    code?: string;
    issuer?: string;
  };
  amount?: string;
  price?: string;
  offerDetails?: any;
}

export interface LedgerEvent {
  sequence: number;
  hash: string;
  prevHash: string;
  transactionCount: number;
  operationCount: number;
  closedAt: string;
  totalCoins: string;
  feePool: string;
  baseFee: number;
  baseReserve: number;
}

// Alert system types
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertType {
  HIGH_VALUE_TRANSACTION = 'high_value_transaction',
  RAPID_TRANSACTIONS = 'rapid_transactions',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  FRAUD_DETECTED = 'fraud_detected',
  SYSTEM_ERROR = 'system_error',
  CONNECTION_LOST = 'connection_lost'
}

export interface AlertRule {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  name: string;
  description: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  enabled: boolean;
  cooldownPeriod?: number; // in milliseconds
}

export interface AlertCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains' | 'matches';
  value: any;
  timeWindow?: number; // in milliseconds
}

export interface AlertAction {
  type: 'webhook' | 'email' | 'websocket' | 'log';
  config: {
    url?: string;
    email?: string;
    channel?: string;
    template?: string;
  };
}

export interface Alert {
  id: string;
  ruleId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data: any;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  transactionId?: string;
}

// Analytics and metrics types
export interface TransactionMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolume: number;
  averageTransactionValue: number;
  transactionsPerSecond: number;
  uniqueAccounts: number;
  topAssets: AssetMetric[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface AssetMetric {
  asset: {
    type: string;
    code?: string;
    issuer?: string;
  };
  volume: number;
  transactionCount: number;
  averageAmount: number;
}

export interface AccountActivity {
  accountId: string;
  transactionCount: number;
  totalSent: number;
  totalReceived: number;
  firstSeen: Date;
  lastSeen: Date;
  riskScore: number;
  flags: string[];
}

export interface NetworkMetrics {
  ledgerNumber: number;
  transactionThroughput: number;
  averageFee: number;
  totalAccounts: number;
  networkHealth: 'healthy' | 'degraded' | 'critical';
  timestamp: Date;
}

// Dashboard data types
export interface DashboardData {
  overview: {
    realTimeMetrics: TransactionMetrics;
    networkStatus: NetworkMetrics;
    alertSummary: AlertSummary;
    systemHealth: SystemHealth;
  };
  recentTransactions: TransactionEvent[];
  recentAlerts: Alert[];
  topAccounts: AccountActivity[];
  charts: {
    transactionVolume: ChartDataPoint[];
    transactionCount: ChartDataPoint[];
    alertTrends: ChartDataPoint[];
  };
}

export interface AlertSummary {
  total: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<AlertType, number>;
  unacknowledged: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  processingLatency: number;
  memoryUsage: number;
  lastHealthCheck: Date;
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

// WebSocket and streaming types
export interface StreamEvent {
  type: 'transaction' | 'ledger' | 'operation' | 'account';
  data: any;
  timestamp: Date;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

// Transaction categorization types
export enum TransactionCategory {
  NORMAL = 'normal',
  HIGH_VALUE = 'high_value',
  RAPID_SEQUENCE = 'rapid_sequence',
  SUSPICIOUS = 'suspicious',
  FRAUDULENT = 'fraudulent',
  WHALE_MOVEMENT = 'whale_movement',
  DEX_TRADE = 'dex_trade',
  PAYMENT = 'payment',
  TRUST_LINE = 'trust_line'
}

export interface TransactionAnalysis {
  transactionId: string;
  category: TransactionCategory;
  riskScore: number;
  flags: string[];
  confidence: number;
  analysis: {
    volumeAnalysis?: VolumeAnalysis;
    patternAnalysis?: PatternAnalysis;
    networkAnalysis?: NetworkAnalysis;
  };
  timestamp: Date;
}

export interface VolumeAnalysis {
  amount: number;
  percentileRank: number;
  isHighValue: boolean;
  historicalComparison: number;
}

export interface PatternAnalysis {
  isRapidSequence: boolean;
  sequenceCount: number;
  timeWindow: number;
  similarPatterns: number;
  anomalyScore: number;
}

export interface NetworkAnalysis {
  sourceReputation: number;
  destinationReputation: number;
  pathAnalysis?: {
    hopCount: number;
    knownEntities: string[];
    riskFactors: string[];
  };
}

// Event emitter interface for type safety
export interface MonitoringEvents {
  'transaction': (transaction: TransactionEvent, analysis: TransactionAnalysis) => void;
  'ledger': (ledger: LedgerEvent) => void;
  'alert': (alert: Alert) => void;
  'error': (error: Error) => void;
  'connected': () => void;
  'disconnected': (reason: string) => void;
  'reconnecting': (attempt: number) => void;
  'metrics': (metrics: TransactionMetrics) => void;
}

// Use Node.js EventEmitter
export type MonitoringEventEmitter = any; // EventEmitter type will be resolved at runtime