# Real-Time Transaction Monitoring System

A comprehensive blockchain transaction monitoring system with AI-powered analytics, real-time alerts, and detailed reporting capabilities.

## Features

✅ **Real-time WebSocket Connection to Stellar Horizon**
- Persistent WebSocket streaming with auto-reconnection
- High-throughput transaction processing with batching
- Connection health monitoring and error handling

✅ **Advanced Transaction Filtering and Categorization**
- Configurable filters by account, asset type, amount ranges
- AI-powered transaction categorization (normal, suspicious, high-value)
- Pattern recognition for rapid transaction sequences

✅ **Real-time Alert System**
- Configurable alert rules with multiple severity levels
- Multiple notification channels (WebSocket, webhook, email)
- Alert deduplication and cooldown periods
- Alert history and acknowledgment tracking

✅ **Transaction Analytics and Reporting**
- Real-time metrics calculation (TPS, volume, success rates)
- Account activity tracking and risk scoring
- Asset volume analysis and trending
- Comprehensive analytics reports with insights

✅ **Transaction Replay and Verification**
- Historical transaction replay for analysis
- Blockchain state verification
- Audit trail capabilities

✅ **Monitoring Dashboard and Metrics**
- Real-time dashboard data aggregation
- System health monitoring
- Interactive charts and visualizations
- Data export capabilities (JSON, CSV)

## Quick Start

```typescript
import { 
  TransactionMonitor, 
  MonitoringConfig,
  AlertType,
  AlertSeverity 
} from '@chenaikit/core';

// Configure monitoring
const config: MonitoringConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  network: 'testnet',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  batchSize: 100,
  alertThresholds: {
    highVolumeAmount: 10000,
    rapidTransactionCount: 20,
    rapidTransactionWindow: 300000, // 5 minutes
    suspiciousPatternScore: 0.8
  },
  filters: {
    minAmount: 100,
    excludeAccounts: ['GABC123...'] // Known test accounts
  }
};

// Initialize monitor
const monitor = new TransactionMonitor(config);

// Set up event listeners
monitor.on('transaction', (transaction, analysis) => {
  console.log(`New transaction: ${transaction.hash}`);
  console.log(`Risk score: ${analysis.riskScore}`);
});

monitor.on('alert', (alert) => {
  console.log(`ALERT [${alert.severity}]: ${alert.title}`);
  // Handle alert (send notification, update UI, etc.)
});

monitor.on('error', (error) => {
  console.error('Monitoring error:', error);
});

// Start monitoring
await monitor.start();
```

## Configuration Options

### Basic Configuration
```typescript
interface MonitoringConfig {
  horizonUrl: string;           // Stellar Horizon API URL
  network: 'testnet' | 'mainnet'; // Stellar network
  reconnectInterval?: number;   // Auto-reconnect interval (ms)
  maxReconnectAttempts?: number; // Max reconnection attempts
  batchSize?: number;          // Transaction batch size for processing
  alertThresholds?: AlertThresholds;
  filters?: TransactionFilterConfig;
}
```

### Alert Configuration
```typescript
interface AlertThresholds {
  highVolumeAmount: number;        // Alert threshold for high-value transactions
  rapidTransactionCount: number;   // Number of transactions to trigger rapid sequence alert
  rapidTransactionWindow: number;  // Time window for rapid sequence detection (ms)
  suspiciousPatternScore: number;  // AI confidence threshold for suspicious patterns
}
```

### Transaction Filters
```typescript
interface TransactionFilterConfig {
  accounts?: string[];          // Monitor specific accounts only
  assets?: string[];           // Monitor specific assets only
  minAmount?: number;          // Minimum transaction amount
  maxAmount?: number;          // Maximum transaction amount
  operations?: string[];       // Monitor specific operation types
  excludeAccounts?: string[];  // Exclude specific accounts
}
```

## Alert System

### Creating Custom Alert Rules
```typescript
import { AlertRule, AlertType, AlertSeverity } from '@chenaikit/core';

const customRule: AlertRule = {
  id: 'large_payment_rule',
  type: AlertType.HIGH_VALUE_TRANSACTION,
  severity: AlertSeverity.HIGH,
  name: 'Large Payment Detection',
  description: 'Alert for payments exceeding 50,000 XLM',
  conditions: [
    {
      field: 'transaction.operations.amount',
      operator: 'gt',
      value: 50000
    },
    {
      field: 'transaction.operations.type',
      operator: 'eq',
      value: 'payment'
    }
  ],
  actions: [
    {
      type: 'webhook',
      config: {
        url: 'https://your-server.com/alerts',
        template: 'large_payment'
      }
    },
    {
      type: 'email',
      config: {
        email: 'alerts@yourcompany.com'
      }
    }
  ],
  enabled: true,
  cooldownPeriod: 600000 // 10 minutes
};

// Add the rule to the monitor
monitor.addAlertRule(customRule);
```

### Alert Types
- `HIGH_VALUE_TRANSACTION` - Large transaction amounts
- `RAPID_TRANSACTIONS` - Rapid sequence of transactions
- `SUSPICIOUS_PATTERN` - AI-detected suspicious patterns
- `FRAUD_DETECTED` - Confirmed fraudulent activity
- `SYSTEM_ERROR` - System or connection errors
- `CONNECTION_LOST` - WebSocket connection issues

## Analytics and Metrics

### Getting Real-time Metrics
```typescript
// Get current metrics
const metrics = monitor.analytics.getRealtimeMetrics();
console.log(`TPS: ${metrics.transactionsPerSecond}`);
console.log(`Total Volume: ${metrics.totalVolume}`);
console.log(`Success Rate: ${(metrics.successfulTransactions / metrics.totalTransactions) * 100}%`);

// Get historical metrics
const historicalMetrics = await monitor.getMetrics(
  new Date('2024-01-01'),
  new Date('2024-01-02')
);
```

### Account Activity Analysis
```typescript
// Get top active accounts
const topAccounts = monitor.analytics.getAccountActivity(10);
topAccounts.forEach(account => {
  console.log(`Account ${account.accountId}: ${account.transactionCount} transactions`);
  console.log(`Risk Score: ${account.riskScore}`);
  console.log(`Flags: ${account.flags.join(', ')}`);
});
```

### Generate Analytics Report
```typescript
const report = await monitor.analytics.generateReport(
  new Date('2024-01-01'),
  new Date('2024-01-07')
);

console.log('Weekly Report:', report.summary);
console.log('Top Accounts:', report.topAccounts);
console.log('Insights:', report.insights);
```

## Dashboard Integration

### Getting Dashboard Data
```typescript
// Get complete dashboard data
const dashboardData = await monitor.getDashboardData();

// Real-time updates
monitor.dashboard.on('transaction_update', ({ transaction, analysis }) => {
  // Update UI with new transaction
});

monitor.dashboard.on('alert_update', (alert) => {
  // Update UI with new alert
});

monitor.dashboard.on('health_update', (health) => {
  // Update system health indicators
});
```

### System Health Monitoring
```typescript
const systemHealth = monitor.dashboard.getSystemHealth();
console.log(`Status: ${systemHealth.status}`);
console.log(`Uptime: ${systemHealth.uptime}ms`);
console.log(`Processing Latency: ${systemHealth.processingLatency}ms`);
console.log(`Memory Usage: ${systemHealth.memoryUsage}%`);
```

## Transaction Replay and Verification

### Replaying Historical Transactions
```typescript
// Replay transactions from specific ledger range
await monitor.replayTransactions(12345, 12350);

// Verify specific transaction
const isValid = await monitor.verifyTransaction('transaction_hash_here');
console.log(`Transaction valid: ${isValid}`);
```

## Performance and Scalability

### High-Volume Optimization
```typescript
const highVolumeConfig: MonitoringConfig = {
  horizonUrl: 'https://horizon.stellar.org',
  network: 'mainnet',
  batchSize: 500,              // Larger batches for high volume
  reconnectInterval: 1000,     // Faster reconnection
  alertThresholds: {
    highVolumeAmount: 100000,  // Higher thresholds for mainnet
    rapidTransactionCount: 50,
    rapidTransactionWindow: 300000,
    suspiciousPatternScore: 0.9 // Higher confidence threshold
  }
};
```

### Memory Management
The system automatically manages memory by:
- Rotating transaction buffers (keeps last 1000 transactions)
- Caching with TTL (metrics cached for 30 seconds, alert history for 24 hours)
- Cleaning up old account activity data (24-hour retention)
- Efficient event processing with batching

## Error Handling and Reliability

### Connection Management
- Automatic reconnection with exponential backoff
- Connection health monitoring
- Graceful degradation when connection is lost
- Error event emission for custom handling

### Data Integrity
- Transaction deduplication
- Blockchain state verification
- Audit trail maintenance
- Comprehensive error logging

## Integration Examples

### With Express.js Backend
```typescript
import express from 'express';
import { TransactionMonitor } from '@chenaikit/core';

const app = express();
const monitor = new TransactionMonitor(config);

// API endpoint for dashboard data
app.get('/api/dashboard', async (req, res) => {
  const data = await monitor.getDashboardData();
  res.json(data);
});

// WebSocket for real-time updates
monitor.on('transaction', (tx, analysis) => {
  // Broadcast to connected clients
  io.emit('transaction', { tx, analysis });
});

await monitor.start();
```

### With React Frontend
```typescript
import { useEffect, useState } from 'react';

function MonitoringDashboard() {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    // Fetch initial data
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setMetrics);
      
    // Set up WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:3000');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transaction') {
        // Update UI with new transaction
      }
    };
    
    return () => ws.close();
  }, []);
  
  return (
    <div>
      {metrics && (
        <div>
          <h2>Real-time Metrics</h2>
          <p>TPS: {metrics.overview.realTimeMetrics.transactionsPerSecond}</p>
          <p>Volume: {metrics.overview.realTimeMetrics.totalVolume}</p>
        </div>
      )}
    </div>
  );
}
```

## Testing and Development

### Running Tests
```bash
# Install dependencies
pnpm install

# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Run with test coverage
pnpm test:coverage
```

### Development Mode
```typescript
const devConfig: MonitoringConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  network: 'testnet',
  batchSize: 10,               // Smaller batches for development
  alertThresholds: {
    highVolumeAmount: 100,     // Lower thresholds for testing
    rapidTransactionCount: 5,
    rapidTransactionWindow: 60000,
    suspiciousPatternScore: 0.5
  }
};
```

## Best Practices

1. **Configure appropriate thresholds** for your use case
2. **Use filtering** to focus on relevant transactions
3. **Implement proper error handling** for production use
4. **Monitor system resources** under high load
5. **Set up proper logging** for troubleshooting
6. **Use WebSocket events** for real-time UI updates
7. **Implement alert acknowledgment** workflows
8. **Regular backup** of alert history and metrics

## Troubleshooting

### Common Issues

**Connection Problems**
- Check Horizon URL and network configuration
- Verify internet connection and firewall settings
- Monitor connection events and error logs

**High Memory Usage**
- Reduce batch size and buffer limits
- Increase cleanup intervals
- Monitor for memory leaks in custom handlers

**Missing Transactions**
- Check transaction filters
- Verify WebSocket connection stability
- Review processing latency metrics

**False Alerts**
- Adjust alert thresholds
- Review alert rule conditions
- Implement alert cooldown periods

## API Reference

See the [complete API documentation](./api-reference.md) for detailed method signatures and interfaces.

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines on contributing to this monitoring system.