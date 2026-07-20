import { Server } from 'socket.io';
import { getIO, NAMESPACES } from '../websocket';
import { log } from '../utils/logger';

export interface AlertEventPayload {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string | number;
  metadata?: Record<string, any>;
}

export interface CreditScoreEventPayload {
  userId: string;
  score: number;
  previousScore?: number;
  change: number;
  tier: string;
  timestamp: string | number;
  factors?: string[];
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

export interface SystemMetricsEventPayload {
  tps: number;
  activeUsers: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  latencyMs: number;
  timestamp: string | number;
}

export class WebSocketService {
  private getIOInstance(): Server | null {
    try {
      return getIO();
    } catch {
      return null;
    }
  }

  /**
   * Emit an event to a specific namespace
   */
  public emitToNamespace(namespace: string, event: string, payload: any): void {
    const io = this.getIOInstance();
    if (!io) {
      log.debug('WebSocket server not initialized; suppressing emit', { namespace, event });
      return;
    }

    try {
      io.of(namespace).emit(event, payload);
    } catch (error) {
      log.error('Failed to emit WebSocket event', { namespace, event, error });
    }
  }

  /**
   * Emit an event to a specific user across a namespace
   */
  public emitToUser(namespace: string, userId: string, event: string, payload: any): void {
    const io = this.getIOInstance();
    if (!io) return;

    try {
      io.of(namespace).to(`user:${userId}`).emit(event, payload);
    } catch (error) {
      log.error('Failed to emit WebSocket event to user', { namespace, userId, event, error });
    }
  }

  /**
   * Broadcast real-time fraud alert
   */
  public broadcastAlert(alert: AlertEventPayload, targetUserId?: string): void {
    if (targetUserId) {
      this.emitToUser(NAMESPACES.ALERTS, targetUserId, 'alert:new', alert);
    } else {
      this.emitToNamespace(NAMESPACES.ALERTS, 'alert:new', alert);
    }
  }

  /**
   * Broadcast credit score update
   */
  public broadcastCreditScoreUpdate(scoreData: CreditScoreEventPayload): void {
    // Send to specific user room and namespace broad scope
    this.emitToUser(NAMESPACES.SCORES, scoreData.userId, 'score:updated', scoreData);
    this.emitToNamespace(NAMESPACES.SCORES, 'score:recalculated', scoreData);
  }

  /**
   * Broadcast live transaction notification
   */
  public broadcastTransaction(transaction: TransactionEventPayload): void {
    if (transaction.userId) {
      this.emitToUser(NAMESPACES.TRANSACTIONS, transaction.userId, 'transaction:new', transaction);
    }
    this.emitToNamespace(NAMESPACES.TRANSACTIONS, 'transaction:analyzed', transaction);
  }

  /**
   * Broadcast system performance metrics
   */
  public broadcastMetrics(metrics: SystemMetricsEventPayload): void {
    this.emitToNamespace(NAMESPACES.TRANSACTIONS, 'metrics:update', metrics);
    this.emitToNamespace(NAMESPACES.ALERTS, 'metrics:update', metrics);
    this.emitToNamespace(NAMESPACES.SCORES, 'metrics:update', metrics);
  }
}

export const websocketService = new WebSocketService();
