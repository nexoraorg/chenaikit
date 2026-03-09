import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TransactionEvent, 
  TransactionAnalysis, 
  TransactionCategory,
  Alert 
} from '@chenaikit/core';
import { useWebSocket } from '../hooks/useWebSocket';

interface LiveTransactionFeedProps {
  maxItems?: number;
  showAnalysis?: boolean;
  autoScroll?: boolean;
  onTransactionClick?: (transaction: TransactionEvent, analysis: TransactionAnalysis) => void;
  className?: string;
}

const LiveTransactionFeed: React.FC<LiveTransactionFeedProps> = ({
  maxItems = 50,
  showAnalysis = true,
  autoScroll = true,
  onTransactionClick,
  className = ''
}) => {
  const [transactions, setTransactions] = useState<Array<{
    transaction: TransactionEvent;
    analysis: TransactionAnalysis;
    timestamp: Date;
  }>>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    recentTransactions,
    recentAlerts,
    connect,
    disconnect
  } = useWebSocket({
    onTransaction: (transaction: TransactionEvent, analysis: TransactionAnalysis) => {
      if (!isPaused) {
        setTransactions(prev => [
          { transaction, analysis, timestamp: new Date() },
          ...prev.slice(0, maxItems - 1)
        ]);
      }
    },
    onAlert: (alert: Alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 9)]);
    }
  });

  // Update transactions when recent transactions change
  useEffect(() => {
    if (!isPaused) {
      setTransactions(prev => {
        const newTransactions = recentTransactions.slice(0, maxItems - prev.length).map(tx => ({
          transaction: tx,
          analysis: {
            transactionId: tx.id,
            category: TransactionCategory.NORMAL,
            riskScore: Math.random() * 100,
            flags: [],
            confidence: 0.8,
            analysis: {},
            timestamp: new Date()
          },
          timestamp: new Date()
        }));
        return [...newTransactions, ...prev.slice(0, maxItems - newTransactions.length)];
      });
    }
  }, [recentTransactions, maxItems, isPaused]);

  // Update alerts when recent alerts change
  useEffect(() => {
    setAlerts(recentAlerts.slice(0, 10));
  }, [recentAlerts]);

  const getCategoryColor = (category: TransactionCategory): string => {
    switch (category) {
      case TransactionCategory.NORMAL:
        return 'bg-green-100 text-green-800';
      case TransactionCategory.HIGH_VALUE:
        return 'bg-blue-100 text-blue-800';
      case TransactionCategory.SUSPICIOUS:
        return 'bg-yellow-100 text-yellow-800';
      case TransactionCategory.FRAUDULENT:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskScoreColor = (riskScore: number): string => {
    if (riskScore < 30) return 'text-green-600';
    if (riskScore < 60) return 'text-yellow-600';
    if (riskScore < 80) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Live Transaction Feed</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : isReconnecting ? `Reconnecting (${reconnectAttempts})` : 'Disconnected'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={isConnected ? disconnect : connect}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-red-600">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-2 bg-red-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{alert.title}</div>
                    <div className="text-xs text-gray-600">{alert.message}</div>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <div className="text-sm text-gray-600">
            Showing {transactions.length} recent transactions
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {transactions.map(({ transaction, analysis, timestamp }, index) => (
                <div
                  key={`${transaction.id}-${index}`}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onTransactionClick?.(transaction, analysis)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getCategoryColor(analysis.category)}>
                        {analysis.category.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatTime(timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${getRiskScoreColor(analysis.riskScore)}`}>
                        Risk: {analysis.riskScore.toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatAmount(transaction.fee)} XLM
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Hash:</span>
                      <span className="ml-1 font-mono truncate">
                        {transaction.hash.substring(0, 10)}...
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">From:</span>
                      <span className="ml-1 font-mono truncate">
                        {transaction.sourceAccount.substring(0, 8)}...
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ledger:</span>
                      <span className="ml-1">{transaction.ledger}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Operations:</span>
                      <span className="ml-1">{transaction.operationCount}</span>
                    </div>
                  </div>

                  {showAnalysis && analysis.flags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {analysis.flags.map((flag, flagIndex) => (
                        <Badge key={flagIndex} variant="outline" className="text-xs">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {transactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {isConnected ? 'Waiting for transactions...' : 'Connect to start monitoring'}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveTransactionFeed;
