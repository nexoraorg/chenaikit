import { EventEmitter } from 'eventemitter3';
import NodeCache from 'node-cache';
import { 
  MonitoringConfig, 
  Alert, 
  AlertRule, 
  AlertType, 
  AlertSeverity,
  AlertCondition,
  AlertAction,
  TransactionEvent,
  TransactionAnalysis
} from './types';

/**
 * Alert system for managing and triggering monitoring alerts
 */
export class AlertSystem extends EventEmitter {
  private config: MonitoringConfig;
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: NodeCache;
  private cooldownCache: NodeCache;
  private webhookQueue: Alert[] = [];
  private processingWebhooks: boolean = false;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    
    // Cache for alert history (24 hours retention)
    this.alertHistory = new NodeCache({ 
      stdTTL: 86400, // 24 hours
      checkperiod: 3600 // cleanup every hour
    });
    
    // Cache for alert cooldowns
    this.cooldownCache = new NodeCache({ 
      stdTTL: 3600, // 1 hour default cooldown
      checkperiod: 300 // cleanup every 5 minutes
    });

    this.initializeDefaultRules();
  }

  /**
   * Start the alert system
   */
  public async start(): Promise<void> {
    console.log('Alert system started');
    this.processWebhookQueue();
  }

  /**
   * Stop the alert system
   */
  public async stop(): Promise<void> {
    this.alertHistory.flushAll();
    this.cooldownCache.flushAll();
    console.log('Alert system stopped');
  }

  /**
   * Add or update an alert rule
   */
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Alert rule added: ${rule.name}`);
  }

  /**
   * Remove an alert rule
   */
  public removeRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      console.log(`Alert rule removed: ${ruleId}`);
    }
  }

  /**
   * Get all alert rules
   */
  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get alert rule by ID
   */
  public getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Trigger an alert
   */
  public async triggerAlert(alert: Alert): Promise<void> {
    try {
      // Check if alert is in cooldown period
      if (this.isInCooldown(alert)) {
        return;
      }

      // Store alert in history
      this.alertHistory.set(alert.id, alert);
      
      // Set cooldown if rule specifies one
      const rule = this.rules.get(alert.ruleId);
      if (rule && rule.cooldownPeriod) {
        const cooldownKey = `${alert.ruleId}_${this.getCooldownKey(alert)}`;
        this.cooldownCache.set(cooldownKey, true, rule.cooldownPeriod / 1000);
      }

      // Emit alert event
      this.emit('alert', alert);

      // Execute alert actions
      if (rule) {
        await this.executeAlertActions(alert, rule.actions);
      }

      console.log(`Alert triggered: ${alert.title} (${alert.severity})`);

    } catch (error) {
      console.error('Error triggering alert:', error);
      throw error;
    }
  }

  /**
   * Evaluate transaction against alert rules
   */
  public async evaluateTransaction(transaction: TransactionEvent, analysis: TransactionAnalysis): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      try {
        if (await this.evaluateRule(rule, transaction, analysis)) {
          const alert = this.createAlert(rule, transaction, analysis);
          triggeredAlerts.push(alert);
          await this.triggerAlert(alert);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Get alert history
   */
  public getAlertHistory(limit: number = 100): Alert[] {
    const allAlerts = this.alertHistory.mget(this.alertHistory.keys()) as { [key: string]: Alert };
    const alerts = Object.values(allAlerts);
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return alerts.slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.get(alertId) as Alert;
    if (alert) {
      alert.acknowledged = true;
      this.alertHistory.set(alertId, alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alertHistory.get(alertId) as Alert;
    if (alert) {
      alert.resolvedAt = new Date();
      this.alertHistory.set(alertId, alert);
      return true;
    }
    return false;
  }

  /**
   * Get alert statistics
   */
  public getAlertStats(): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    unacknowledged: number;
  } {
    const alerts = this.getAlertHistory(1000); // Get last 1000 alerts for stats
    
    const stats = {
      total: alerts.length,
      bySeverity: {
        [AlertSeverity.LOW]: 0,
        [AlertSeverity.MEDIUM]: 0,
        [AlertSeverity.HIGH]: 0,
        [AlertSeverity.CRITICAL]: 0
      },
      byType: {
        [AlertType.HIGH_VALUE_TRANSACTION]: 0,
        [AlertType.RAPID_TRANSACTIONS]: 0,
        [AlertType.SUSPICIOUS_PATTERN]: 0,
        [AlertType.FRAUD_DETECTED]: 0,
        [AlertType.SYSTEM_ERROR]: 0,
        [AlertType.CONNECTION_LOST]: 0
      },
      unacknowledged: 0
    };

    alerts.forEach(alert => {
      stats.bySeverity[alert.severity]++;
      stats.byType[alert.type]++;
      if (!alert.acknowledged) {
        stats.unacknowledged++;
      }
    });

    return stats;
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    // High value transaction rule
    const highValueRule: AlertRule = {
      id: 'high_value_rule',
      type: AlertType.HIGH_VALUE_TRANSACTION,
      severity: AlertSeverity.MEDIUM,
      name: 'High Value Transaction',
      description: 'Alert when a transaction exceeds the high value threshold',
      conditions: [
        {
          field: 'analysis.volumeAnalysis.isHighValue',
          operator: 'eq',
          value: true
        }
      ],
      actions: [
        {
          type: 'websocket',
          config: { channel: 'alerts' }
        },
        {
          type: 'log',
          config: {}
        }
      ],
      enabled: true,
      cooldownPeriod: 300000 // 5 minutes
    };

    // Fraud detection rule
    const fraudRule: AlertRule = {
      id: 'fraud_detection_rule',
      type: AlertType.FRAUD_DETECTED,
      severity: AlertSeverity.HIGH,
      name: 'Fraud Detection',
      description: 'Alert when fraud is detected',
      conditions: [
        {
          field: 'analysis.flags',
          operator: 'contains',
          value: 'fraud_detected'
        }
      ],
      actions: [
        {
          type: 'websocket',
          config: { channel: 'alerts' }
        },
        {
          type: 'webhook',
          config: { 
            url: process.env.FRAUD_WEBHOOK_URL || '',
            template: 'fraud_alert'
          }
        }
      ],
      enabled: true,
      cooldownPeriod: 60000 // 1 minute
    };

    // Rapid transactions rule
    const rapidRule: AlertRule = {
      id: 'rapid_sequence_rule',
      type: AlertType.RAPID_TRANSACTIONS,
      severity: AlertSeverity.MEDIUM,
      name: 'Rapid Transaction Sequence',
      description: 'Alert when rapid transaction sequences are detected',
      conditions: [
        {
          field: 'analysis.patternAnalysis.isRapidSequence',
          operator: 'eq',
          value: true
        }
      ],
      actions: [
        {
          type: 'websocket',
          config: { channel: 'alerts' }
        }
      ],
      enabled: true,
      cooldownPeriod: 600000 // 10 minutes
    };

    this.addRule(highValueRule);
    this.addRule(fraudRule);
    this.addRule(rapidRule);
  }

  /**
   * Evaluate a rule against transaction data
   */
  private async evaluateRule(rule: AlertRule, transaction: TransactionEvent, analysis: TransactionAnalysis): Promise<boolean> {
    try {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, transaction, analysis)) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
      return false;
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: AlertCondition, transaction: TransactionEvent, analysis: TransactionAnalysis): boolean {
    const value = this.getFieldValue(condition.field, transaction, analysis);
    
    switch (condition.operator) {
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'contains':
        if (Array.isArray(value)) {
          return value.includes(condition.value);
        }
        return String(value).includes(String(condition.value));
      case 'matches':
        const regex = new RegExp(condition.value);
        return regex.test(String(value));
      default:
        return false;
    }
  }

  /**
   * Get field value from transaction or analysis data
   */
  private getFieldValue(fieldPath: string, transaction: TransactionEvent, analysis: TransactionAnalysis): any {
    const data = { transaction, analysis };
    
    try {
      return fieldPath.split('.').reduce((obj, key) => {
        return obj && obj[key] !== undefined ? obj[key] : undefined;
      }, data as any);
    } catch {
      return undefined;
    }
  }

  /**
   * Create alert from rule and transaction data
   */
  private createAlert(rule: AlertRule, transaction: TransactionEvent, analysis: TransactionAnalysis): Alert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      type: rule.type,
      severity: rule.severity,
      title: rule.name,
      message: this.generateAlertMessage(rule, transaction, analysis),
      data: { transaction, analysis },
      timestamp: new Date(),
      acknowledged: false,
      transactionId: transaction.id
    };
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, transaction: TransactionEvent, analysis: TransactionAnalysis): string {
    switch (rule.type) {
      case AlertType.HIGH_VALUE_TRANSACTION:
        return `High value transaction detected: ${transaction.hash} (Risk Score: ${analysis.riskScore})`;
      case AlertType.FRAUD_DETECTED:
        return `Potential fraud detected in transaction: ${transaction.hash}`;
      case AlertType.RAPID_TRANSACTIONS:
        return `Rapid transaction sequence detected from account: ${transaction.sourceAccount}`;
      case AlertType.SUSPICIOUS_PATTERN:
        return `Suspicious pattern detected in transaction: ${transaction.hash}`;
      default:
        return `${rule.name} triggered for transaction: ${transaction.hash}`;
    }
  }

  /**
   * Check if alert is in cooldown period
   */
  private isInCooldown(alert: Alert): boolean {
    const rule = this.rules.get(alert.ruleId);
    if (!rule || !rule.cooldownPeriod) {
      return false;
    }

    const cooldownKey = `${alert.ruleId}_${this.getCooldownKey(alert)}`;
    return this.cooldownCache.has(cooldownKey);
  }

  /**
   * Get cooldown key for alert
   */
  private getCooldownKey(alert: Alert): string {
    // Use transaction source account as cooldown key for most alerts
    if (alert.data && alert.data.transaction) {
      return alert.data.transaction.sourceAccount;
    }
    return 'global';
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(alert: Alert, actions: AlertAction[]): Promise<void> {
    const executionPromises = actions.map(action => this.executeAction(alert, action));
    
    try {
      await Promise.all(executionPromises);
    } catch (error) {
      console.error('Error executing alert actions:', error);
    }
  }

  /**
   * Execute individual alert action
   */
  private async executeAction(alert: Alert, action: AlertAction): Promise<void> {
    try {
      switch (action.type) {
        case 'websocket':
          // WebSocket notifications handled by event emission
          break;

        case 'webhook':
          if (action.config.url) {
            this.webhookQueue.push(alert);
            this.processWebhookQueue();
          }
          break;

        case 'email':
          // Email notifications would be implemented here
          console.log(`Email alert: ${alert.title}`);
          break;

        case 'log':
          console.log(`ALERT [${alert.severity.toUpperCase()}]: ${alert.title} - ${alert.message}`);
          break;

        default:
          console.warn(`Unknown alert action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing ${action.type} action:`, error);
    }
  }

  /**
   * Process webhook queue
   */
  private async processWebhookQueue(): Promise<void> {
    if (this.processingWebhooks || this.webhookQueue.length === 0) {
      return;
    }

    this.processingWebhooks = true;

    try {
      while (this.webhookQueue.length > 0) {
        const alert = this.webhookQueue.shift();
        if (alert) {
          await this.sendWebhook(alert);
        }
        
        // Small delay between webhook calls
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing webhook queue:', error);
    } finally {
      this.processingWebhooks = false;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(alert: Alert): Promise<void> {
    try {
      const rule = this.rules.get(alert.ruleId);
      if (!rule) return;

      const webhookAction = rule.actions.find(action => action.type === 'webhook');
      if (!webhookAction || !webhookAction.config.url) return;

      const payload = {
        alert: {
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          transactionId: alert.transactionId
        },
        transaction: alert.data.transaction,
        analysis: alert.data.analysis
      };

      const response = await fetch(webhookAction.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ChenAIKit-AlertSystem/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      console.log(`Webhook sent successfully for alert: ${alert.id}`);

    } catch (error) {
      console.error(`Failed to send webhook for alert ${alert.id}:`, error);
      
      // Optionally retry webhook (implement retry logic here)
    }
  }
}