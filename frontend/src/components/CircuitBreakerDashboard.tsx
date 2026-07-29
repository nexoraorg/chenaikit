import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastStateChange: number;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  blockedRequests: number;
  lastRiskScore?: number;
  lastTriggerReason?: string;
  triggerHistory: TriggerEvent[];
}

interface TriggerEvent {
  timestamp: number;
  fromState: string;
  toState: string;
  reason: string;
  riskScore: number;
  transactionId: string;
  explainableFactors: string[];
}

interface CircuitBreakerDashboardProps {
  apiBaseUrl?: string;
}

export const CircuitBreakerDashboard: React.FC<CircuitBreakerDashboardProps> = ({
  apiBaseUrl = '/api/circuit-breaker',
}) => {
  const [state, setState] = useState<CircuitBreakerState | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [stateRes, metricsRes, configRes] = await Promise.all([
        fetch(`${apiBaseUrl}/state`),
        fetch(`${apiBaseUrl}/metrics`),
        fetch(`${apiBaseUrl}/config`),
      ]);

      if (!stateRes.ok || !metricsRes.ok || !configRes.ok) {
        throw new Error('Failed to fetch circuit breaker data');
      }

      const [stateData, metricsData, configData] = await Promise.all([
        stateRes.json(),
        metricsRes.json(),
        configRes.json(),
      ]);

      setState(stateData.data);
      setMetrics(metricsData.data);
      setConfig(configData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset circuit breaker');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    }
  };

  const handleConfigUpdate = async (newConfig: any) => {
    try {
      const res = await fetch(`${apiBaseUrl}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) throw new Error('Failed to update config');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const getStateColor = (currentState: string) => {
    switch (currentState) {
      case 'CLOSED':
        return 'bg-green-500';
      case 'OPEN':
        return 'bg-red-500';
      case 'HALF_OPEN':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStateBadgeVariant = (currentState: string) => {
    switch (currentState) {
      case 'CLOSED':
        return 'success';
      case 'OPEN':
        return 'destructive';
      case 'HALF_OPEN':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  if (loading && !state) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading circuit breaker status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="text-red-600">Error: {error}</div>
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Circuit Breaker Status</span>
            <Badge variant={getStateBadgeVariant(state?.state || 'CLOSED') as any}>
              {state?.state}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Requests</div>
              <div className="text-2xl font-bold">{metrics?.totalRequests || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Blocked Requests</div>
              <div className="text-2xl font-bold text-red-600">{metrics?.blockedRequests || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Failure Count</div>
              <div className="text-2xl font-bold">{state?.failureCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Success Count</div>
              <div className="text-2xl font-bold text-green-600">{state?.successCount || 0}</div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Block Rate:</span>
              <span className="font-semibold">
                {((metrics?.blockRate || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Avg Risk Score:</span>
              <span className="font-semibold">{metrics?.avgRiskScore?.toFixed(1) || 0}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button onClick={handleReset} variant="outline" size="sm">
              Reset Circuit Breaker
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Failure Threshold</label>
                <input
                  type="number"
                  className="w-full mt-1 p-2 border rounded"
                  value={config?.failureThreshold || 5}
                  onChange={(e) => handleConfigUpdate({ failureThreshold: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Success Threshold</label>
                <input
                  type="number"
                  className="w-full mt-1 p-2 border rounded"
                  value={config?.successThreshold || 3}
                  onChange={(e) => handleConfigUpdate({ successThreshold: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Timeout (ms)</label>
                <input
                  type="number"
                  className="w-full mt-1 p-2 border rounded"
                  value={config?.timeoutMs || 60000}
                  onChange={(e) => handleConfigUpdate({ timeoutMs: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Risk Score Threshold</label>
                <input
                  type="number"
                  className="w-full mt-1 p-2 border rounded"
                  value={config?.riskScoreThreshold || 70}
                  onChange={(e) => handleConfigUpdate({ riskScoreThreshold: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trigger History */}
      <Card>
        <CardHeader>
          <CardTitle>Trigger History</CardTitle>
        </CardHeader>
        <CardContent>
          {state?.triggerHistory && state.triggerHistory.length > 0 ? (
            <div className="space-y-3">
              {state.triggerHistory.slice(-10).reverse().map((event, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{event.fromState}</Badge>
                      <span>→</span>
                      <Badge variant={getStateBadgeVariant(event.toState) as any}>{event.toState}</Badge>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">{event.reason}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Risk Score: {event.riskScore} | Transaction: {event.transactionId}
                  </div>
                  {event.explainableFactors && event.explainableFactors.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Explainable Factors:</div>
                      <div className="flex flex-wrap gap-1">
                        {event.explainableFactors.map((factor, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">No trigger history available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
