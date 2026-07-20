export type ConnectionStatusType = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export type WebSocketNamespace = '/alerts' | '/scores' | '/transactions';

export interface CreditScoreEvent {
  userId: string;
  score: number;
  previousScore?: number;
  change: number;
  tier: string;
  timestamp: string | number;
  factors?: string[];
}

export interface FraudAlertEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string | number;
  metadata?: Record<string, any>;
}

export interface TransactionEventPayload {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'flagged';
  timestamp: string | number;
  metadata?: Record<string, any>;
}

export interface SystemMetricsEvent {
  tps: number;
  activeUsers: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  latencyMs: number;
  timestamp: string | number;
}

export interface QueuedMessage {
  id: string;
  namespace: WebSocketNamespace | string;
  event: string;
  data: any;
  timestamp: number;
}

export interface WebSocketContextState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
  lastConnected?: Date;
  status: ConnectionStatusType;
}
