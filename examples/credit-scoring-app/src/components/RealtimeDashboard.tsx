import React, { useState, useEffect } from 'react';
import { 
  TransactionEvent, 
  TransactionAnalysis, 
  TransactionCategory,
  Alert,
  AlertSeverity 
} from '@chenaikit/core';
import { useWebSocket } from '../hooks/useWebSocket';

interface RealtimeDashboardProps {
  refreshInterval?: number;
  showCharts?: boolean;
  maxChartPoints?: number;
  className?: string;
}

const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({
  refreshInterval = 5000,
  showCharts = true,
  maxChartPoints = 50,
  className = ''
}) => {
  const [chartData, setChartData] = useState({
    transactionVolume: [] as Array<{time: string, value: number}>,
    transactionCount: [] as Array<{time: string, value: number}>,
    riskScores: [] as Array<{time: string, value: number}>,
    alerts: [] as Array<{time: string, severity: string}>
  });

  const [systemHealth, setSystemHealth] = useState({
    cpu: 0,
    memory: 0,
    latency: 0,
    uptime: 0
  });

  const {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    recentTransactions,
    recentAlerts,
    metrics,
    connect,
    disconnect
  } = useWebSocket({
    onTransaction: (transaction: TransactionEvent, analysis: TransactionAnalysis) => {
      updateChartData(transaction, analysis);
    },
    onAlert: (alert: Alert) => {
      updateAlertData(alert);
    }
  });

  // Update chart data with new transaction
  const updateChartData = (transaction: TransactionEvent, analysis: TransactionAnalysis) => {
    const now = new Date().toLocaleTimeString();
    
    setChartData(prev => ({
      transactionVolume: [
        {time: now, value: parseFloat(transaction.fee) * 10},
        ...prev.transactionVolume.slice(0, maxChartPoints - 1)
      ],
      transactionCount: [
        {time: now, value: prev.transactionCount[0]?.value + 1 || 1},
        ...prev.transactionCount.slice(0, maxChartPoints - 1)
      ],
      riskScores: [
        {time: now, value: analysis.riskScore},
        ...prev.riskScores.slice(0, maxChartPoints - 1)
      ],
      alerts: prev.alerts
    }));
  };

  // Update alert data
  const updateAlertData = (alert: Alert) => {
    const now = new Date().toLocaleTimeString();
    
    setChartData(prev => ({
      ...prev,
      alerts: [
        {time: now, severity: alert.severity},
        ...prev.alerts.slice(0, maxChartPoints - 1)
      ]
    }));
  };

  // Simulate system health metrics
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemHealth({
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        latency: Math.random() * 100,
        uptime: Date.now() / 1000
      });
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getSeverityColor = (severity: AlertSeverity): string => {
    switch (severity) {
      case AlertSeverity.LOW:
        return 'bg-green-500';
      case AlertSeverity.MEDIUM:
        return 'bg-yellow-500';
      case AlertSeverity.HIGH:
        return 'bg-orange-500';
      case AlertSeverity.CRITICAL:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Real-time Monitoring Dashboard</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : isReconnecting ? `Reconnecting...` : 'Disconnected'}
              </span>
            </div>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={isConnected ? disconnect : connect}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Total Transactions</div>
            <div className="text-2xl font-bold text-blue-900">
              {metrics.totalTransactions || 0}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Success Rate</div>
            <div className="text-2xl font-bold text-green-900">
              {metrics.totalTransactions ? 
                `${((metrics.successfulTransactions / metrics.totalTransactions) * 100).toFixed(1)}%` : 
                '0%'
              }
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">Total Volume</div>
            <div className="text-2xl font-bold text-purple-900">
              {formatNumber(metrics.totalVolume || 0)}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 font-medium">Transactions/sec</div>
            <div className="text-2xl font-bold text-orange-900">
              {(metrics.transactionsPerSecond || 0).toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transaction Volume Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Transaction Volume</h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {formatNumber(chartData.transactionVolume.reduce((sum, point) => sum + point.value, 0))}
                </div>
                <div className="text-sm text-gray-600">Total Volume (Last {maxChartPoints})</div>
              </div>
            </div>
          </div>

          {/* Risk Score Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Risk Score Trends</h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600">
                  {chartData.riskScores.length > 0 ? 
                    (chartData.riskScores.reduce((sum, point) => sum + point.value, 0) / chartData.riskScores.length).toFixed(1) :
                    '0'
                  }
                </div>
                <div className="text-sm text-gray-600">Average Risk Score</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">CPU Usage</span>
              <span className="text-sm text-gray-600">{systemHealth.cpu.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{width: `${systemHealth.cpu}%`}}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm text-gray-600">{systemHealth.memory.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{width: `${systemHealth.memory}%`}}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Latency</span>
              <span className="text-sm text-gray-600">{systemHealth.latency.toFixed(0)}ms</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{width: `${Math.min(systemHealth.latency, 100)}%`}}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Uptime</span>
              <span className="text-sm text-gray-600">
                {Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{width: `${Math.min((systemHealth.uptime / 86400) * 100, 100)}%`}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentTransactions.slice(0, 10).map((transaction, index) => (
              <div key={`${transaction.id}-${index}`} className="flex items-center justify-between p-2 border rounded">
                <div className="flex-1">
                  <div className="font-mono text-sm">{transaction.hash.substring(0, 10)}...</div>
                  <div className="text-xs text-gray-600">{transaction.sourceAccount.substring(0, 8)}...</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{parseFloat(transaction.fee).toFixed(2)} XLM</div>
                  <div className="text-xs text-gray-600">Ledger {transaction.ledger}</div>
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No transactions yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentAlerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex-1">
                  <div className="font-medium text-sm">{alert.title}</div>
                  <div className="text-xs text-gray-600">{alert.message}</div>
                </div>
                <div className={`w-3 h-3 rounded-full ${getSeverityColor(alert.severity)}`} />
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No alerts
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeDashboard;
