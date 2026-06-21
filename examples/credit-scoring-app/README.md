# Credit Scoring App with Real-time Monitoring

Example application demonstrating credit scoring and real-time blockchain transaction monitoring using ChenAIKit.

## Features

### Core Credit Scoring
- Account balance analysis
- Transaction history evaluation
- Credit score calculation (300-850 range)
- Risk assessment (low/medium/high/critical)
- REST API endpoints

### Real-time Monitoring
- **Live Transaction Feed**: Real-time blockchain transaction monitoring
- **WebSocket Integration**: Persistent connection with automatic reconnection
- **Alert System**: Real-time fraud detection and risk alerts
- **Dashboard**: Live metrics and system health monitoring
- **Connection Status**: Visual indicators for connection state
- **Exponential Backoff**: Smart reconnection handling

### Components
- `useWebSocket` hook for React applications
- `LiveTransactionFeed` component for real-time transaction display
- `RealtimeDashboard` component for monitoring dashboard
- `WebSocketProvider` for React context integration
- WebSocket testing utilities and benchmarking tools

## Setup

```bash
cd examples/credit-scoring-app
npm install
```

## Usage

### Basic Application
```bash
# Start the application
npm start

# Development mode
npm run dev
```

### Real-time Demo
```bash
# Run real-time monitoring demo
npm run demo

# Run WebSocket tests
npm run test

# Run stress tests
npm run stress

# Run benchmarks
npm run benchmark
```

### Manual Testing
```bash
# Run demo with ts-node
ts-node src/index.ts demo

# Run WebSocket tests
ts-node src/index.ts test

# Run stress tests
ts-node src/utils/websocket-test.ts stress

# Run benchmarks
ts-node src/utils/websocket-test.ts benchmark
```

## API Endpoints

### Credit Scoring
- `GET /api/account/:id/balance` - Get account balance
- `GET /api/account/:id/credit-score` - Calculate credit score
- `GET /api/account/:id/risk-assessment` - Get risk assessment

### Real-time Monitoring
- `WebSocket /ws/transactions` - Live transaction stream
- `GET /api/monitoring/status` - Connection status
- `GET /api/monitoring/metrics` - Real-time metrics
- `GET /api/monitoring/alerts` - Recent alerts

## Real-time Features

### WebSocket Connection
- **Automatic Reconnection**: Exponential backoff with configurable limits
- **Connection Status**: Real-time connection state monitoring
- **Error Handling**: Comprehensive error recovery and logging
- **Event-driven Architecture**: Decoupled event emitters for scalability

### Live Transaction Feed
- **Real-time Updates**: Live blockchain transaction monitoring
- **Transaction Analysis**: Real-time risk scoring and categorization
- **Filtering**: Configurable transaction filtering and alerts
- **Performance**: Optimized for high-frequency updates

### Alert System
- **Risk Thresholds**: Configurable risk scoring thresholds
- **Alert Types**: Multiple alert severities and categories
- **Real-time Notifications**: Instant alert delivery via WebSocket
- **Alert History**: Recent alerts tracking and management

### Dashboard Monitoring
- **System Health**: CPU, memory, latency monitoring
- **Transaction Metrics**: Volume, frequency, success rates
- **Risk Analytics**: Real-time risk scoring trends
- **Performance Charts**: Live data visualization

## React Integration

### WebSocket Provider
```tsx
import { WebSocketProvider } from './components/WebSocketProvider';

function App() {
  return (
    <WebSocketProvider url="ws://localhost:8080">
      <YourComponents />
    </WebSocketProvider>
  );
}
```

### Use WebSocket Hook
```tsx
import { useWebSocket } from './hooks/useWebSocket';

function TransactionMonitor() {
  const { isConnected, recentTransactions, connect, disconnect } = useWebSocket({
    onTransaction: (tx, analysis) => {
      console.log('New transaction:', tx.hash);
    },
    onAlert: (alert) => {
      console.log('Alert:', alert.title);
    }
  });

  return (
    <div>
      <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
      <div>Transactions: {recentTransactions.length}</div>
    </div>
  );
}
```

### Live Transaction Feed Component
```tsx
import LiveTransactionFeed from './components/LiveTransactionFeed';

function Dashboard() {
  return (
    <LiveTransactionFeed
      maxItems={50}
      showAnalysis={true}
      onTransactionClick={(tx, analysis) => {
        console.log('Transaction clicked:', tx.hash);
      }}
    />
  );
}
```

### Real-time Dashboard
```tsx
import RealtimeDashboard from './components/RealtimeDashboard';

function MonitoringDashboard() {
  return (
    <RealtimeDashboard
      refreshInterval={5000}
      showCharts={true}
      maxChartPoints={50}
    />
  );
}
```

## Testing

### WebSocket Testing
The application includes comprehensive WebSocket testing utilities:

```typescript
import { WebSocketTester, MockDataGenerator } from './utils/websocket-test';

// Basic test
const tester = new WebSocketTester({
  url: 'ws://localhost:8080',
  testDuration: 30,
  transactionRate: 5,
  enableAlerts: true,
  logLevel: 'info'
});

await tester.runTest();
```

### Stress Testing
```typescript
// Stress test with multiple connections
await tester.stressTest(10); // 10 concurrent connections
```

### Benchmarking
```typescript
// Performance benchmarking
await tester.benchmark();
```

### Mock Data Generation
```typescript
import { MockDataGenerator } from './utils/websocket-test';

// Generate mock transaction
const transaction = MockDataGenerator.generateTransaction();
const analysis = MockDataGenerator.generateAnalysis(transaction);
const alert = MockDataGenerator.generateAlert();
```

## Configuration

### WebSocket Configuration
```typescript
const config = {
  url: 'ws://localhost:8080',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  autoConnect: true
};
```

### Monitoring Configuration
```typescript
const monitoringConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  network: 'testnet',
  alertThresholds: {
    highVolumeAmount: 10000,
    rapidTransactionCount: 10,
    rapidTransactionWindow: 60000,
    suspiciousPatternScore: 80
  }
};
```

## Architecture

### Event-driven Design
- **TransactionMonitor**: Core monitoring engine
- **Event Emitters**: Decoupled event handling
- **WebSocket Provider**: React context for state management
- **Component Architecture**: Modular, reusable components

### Performance Optimizations
- **Connection Pooling**: Efficient WebSocket management
- **Data Buffering**: Optimized data handling
- **Lazy Loading**: On-demand component rendering
- **Memory Management**: Automatic cleanup and garbage collection

### Error Handling
- **Graceful Degradation**: Fallback mechanisms
- **Retry Logic**: Exponential backoff reconnection
- **Error Boundaries**: React error boundaries
- **Logging**: Comprehensive error logging

## Development

### Project Structure
```
src/
├── components/
│   ├── LiveTransactionFeed.tsx     # Live transaction display
│   ├── RealtimeDashboard.tsx       # Monitoring dashboard
│   └── WebSocketProvider.tsx        # React context provider
├── hooks/
│   └── useWebSocket.ts              # WebSocket state management
├── utils/
│   └── websocket-test.ts            # Testing utilities
└── index.ts                        # Main application entry
```

### Adding New Features
1. Extend `TransactionMonitor` for new event types
2. Create new components using the `useWebSocket` hook
3. Add testing utilities in `utils/websocket-test.ts`
4. Update configuration in main application

## Production Considerations

### Scalability
- **Connection Limits**: Configurable connection limits
- **Load Balancing**: Multiple WebSocket servers
- **Caching**: Redis for session management
- **Monitoring**: Prometheus metrics integration

### Security
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Rate Limiting**: Connection rate limiting
- **CORS**: Cross-origin resource sharing

### Reliability
- **Health Checks**: Regular health monitoring
- **Circuit Breakers**: Fault tolerance
- **Graceful Shutdown**: Clean connection termination
- **Monitoring**: Real-time system monitoring

## Examples

### Basic Credit Scoring
```typescript
import { calculateCreditScore, assessRisk } from './index';

const accountData = {
  transactionHistory: [
    { amount: 1000, timestamp: '2023-01-01' },
    { amount: 500, timestamp: '2023-01-02' }
  ],
  accountAge: 365
};

const score = calculateCreditScore(accountData);
const risk = assessRisk(accountData);
console.log(`Score: ${score}, Risk: ${risk}`);
```

### Real-time Monitoring
```typescript
import { CreditScoringMonitor } from './index';

const monitor = new CreditScoringMonitor(config);
await monitor.start();

// Get real-time metrics
const metrics = monitor.getMetrics();
console.log('Metrics:', metrics);
```

## Troubleshooting

### Common Issues
1. **WebSocket Connection Failed**: Check server URL and network connectivity
2. **High Memory Usage**: Reduce buffer sizes or implement pagination
3. **Connection Drops**: Increase reconnection intervals
4. **Performance Issues**: Enable performance monitoring

### Debug Mode
```bash
# Enable debug logging
DEBUG=ws:* npm run demo

# Enable verbose logging
VERBOSE=true npm run demo
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This example application is part of the ChenAIKit project and follows the same license terms.
