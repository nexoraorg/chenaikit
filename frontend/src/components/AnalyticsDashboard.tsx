import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Grid,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Paper,
  Fade,
} from "@mui/material";
import {
  TrendingUp,
  Assessment,
  Public,
  BugReport,
  Download,
  FiberManualRecord as LiveIcon,
} from "@mui/icons-material";
import axios from "axios";
import { UsageChart } from "./charts/UsageChart";
import { DistributionChart } from "./charts/DistributionChart";
import { useWebSocket } from "./WebSocketProvider";
import { ConnectionStatus } from "./ConnectionStatus";

interface DashboardData {
  systemUsage: {
    totalRequests: number;
    avgLatency: number;
    errorRate: number;
    successRate: number;
  };
  aiPerformance: {
    avgCreditScore: number;
    totalFraudAlerts: number;
    resolvedAlerts: number;
    riskDistribution: Record<string, number>;
  };
  blockchainActivity: {
    totalTxCount: number;
    totalVolume: number;
    assetDistribution: Record<string, number>;
  };
}

interface TrendData {
  history: Array<{ date: string; value: number }>;
  forecast: Array<{ date: string; value: number }>;
}

export const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [timeRange, setTimeRange] = useState("30");
  const [hasRealtimeUpdate, setHasRealtimeUpdate] = useState(false);

  const {
    subscribe,
    isConnected,
    metrics: wsMetrics,
    isPaused,
  } = useWebSocket();

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, trendRes] = await Promise.all([
        axios.get(`/api/v1/analytics/dashboard?days=${timeRange}`),
        axios.get(`/api/v1/analytics/trends?days=${timeRange}`),
      ]);

      setDashboardData(dashRes.data.data);
      setTrendData(trendRes.data.data);
      setError(null);
    } catch (err: any) {
      setError(
        "Failed to fetch analytics data. Please ensure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to real-time metrics updates
  useEffect(() => {
    const unsubscribe = subscribe("performanceMetrics", (data) => {
      if (isPaused) return;

      // Merge real-time metrics with existing data
      setDashboardData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          systemUsage: {
            ...prev.systemUsage,
            ...(data.systemUsage || {}),
          },
          aiPerformance: {
            ...prev.aiPerformance,
            ...(data.aiPerformance || {}),
          },
          blockchainActivity: {
            ...prev.blockchainActivity,
            ...(data.blockchainActivity || {}),
          },
        };
      });

      // Show live indicator animation
      setHasRealtimeUpdate(true);
      setTimeout(() => setHasRealtimeUpdate(false), 1000);
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe, isPaused]);

  // Update dashboard with WebSocket metrics
  useEffect(() => {
    if (
      isConnected &&
      wsMetrics &&
      Object.keys(wsMetrics).length > 0 &&
      !isPaused
    ) {
      setDashboardData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          systemUsage: {
            ...prev.systemUsage,
            ...(wsMetrics as any),
          },
        };
      });
    }
  }, [isConnected, wsMetrics, isPaused]);

  const handleExport = async (format: "csv" | "pdf") => {
    window.open(
      `/api/v1/analytics/export?format=${format}&days=${timeRange}`,
      "_blank",
    );
  };

  if (loading)
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh",
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );

  if (error)
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={fetchData} sx={{ mt: 2 }} variant="contained">
          Retry
        </Button>
      </Box>
    );

  return (
    <Box
      sx={{
        flexGrow: 1,
        p: 4,
        bgcolor: "background.default",
        minHeight: "100vh",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              Business Intelligence Dashboard
              <Fade in={hasRealtimeUpdate}>
                <LiveIcon
                  sx={{
                    fontSize: 16,
                    color: "success.main",
                    animation: "pulse 1s ease-in-out",
                  }}
                />
              </Fade>
            </Typography>
            <Typography variant="subtitle1" sx={{ color: "text.secondary" }}>
              Real-time insights across systems, AI, and blockchain
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <ConnectionStatus showControls={true} size="medium" />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Range</InputLabel>
            <Select
              value={timeRange}
              label="Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="7">Last 7 Days</MenuItem>
              <MenuItem value="30">Last 30 Days</MenuItem>
              <MenuItem value="90">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<Download />}
            variant="outlined"
            onClick={() => handleExport("csv")}
          >
            Export CSV
          </Button>
          <Button
            startIcon={<Download />}
            variant="contained"
            onClick={() => handleExport("pdf")}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <KpiCard
          title="Total Requests"
          value={
            dashboardData?.systemUsage.totalRequests.toLocaleString() || "0"
          }
          icon={<Assessment color="primary" />}
          color="#3B82F6"
          isLive={isConnected && !isPaused}
        />
        <KpiCard
          title="Avg Latency"
          value={
            `${dashboardData?.systemUsage.avgLatency.toFixed(2)}ms` || "0ms"
          }
          icon={<TrendingUp sx={{ color: "#10B981" }} />}
          color="#10B981"
          isLive={isConnected && !isPaused}
        />
        <KpiCard
          title="Avg Credit Score"
          value={dashboardData?.aiPerformance.avgCreditScore.toFixed(0) || "0"}
          icon={<BugReport color="warning" />}
          color="#F59E0B"
          isLive={isConnected && !isPaused}
        />
        <KpiCard
          title="Blockchain Vol"
          value={
            dashboardData?.blockchainActivity.totalVolume.toLocaleString() ||
            "0"
          }
          icon={<Public color="secondary" />}
          color="#8B5CF6"
          isLive={isConnected && !isPaused}
        />
      </Grid>

      <Grid container spacing={3}>
        {/* Main Trend Chart */}
        <Grid item xs={12} lg={8}>
          {trendData && (
            <UsageChart
              data={trendData.history}
              forecast={trendData.forecast}
              title="System Traffic & Forecast"
            />
          )}
        </Grid>

        {/* AI Distribution Chart */}
        <Grid item xs={12} md={6} lg={4}>
          {dashboardData && (
            <DistributionChart
              data={dashboardData.aiPerformance.riskDistribution}
              title="Risk Level Distribution"
            />
          )}
        </Grid>

        {/* Asset Distribution */}
        <Grid item xs={12} md={6} lg={4}>
          {dashboardData && (
            <DistributionChart
              data={dashboardData.blockchainActivity.assetDistribution}
              title="Blockchain Assets"
            />
          )}
        </Grid>

        {/* System Health Summary */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography
              variant="h6"
              gutterBottom
              color="primary"
              sx={{ fontWeight: 600 }}
            >
              System Health & Performance
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <HealthStat
                label="Success Rate"
                value={`${dashboardData?.systemUsage.successRate.toFixed(1)}%`}
                status={
                  dashboardData?.systemUsage.successRate &&
                  dashboardData.systemUsage.successRate > 95
                    ? "good"
                    : "warning"
                }
              />
              <HealthStat
                label="Error Rate"
                value={`${dashboardData?.systemUsage.errorRate.toFixed(1)}%`}
                status={
                  dashboardData?.systemUsage.errorRate &&
                  dashboardData.systemUsage.errorRate < 5
                    ? "good"
                    : "critical"
                }
              />
              <HealthStat
                label="Fraud Alerts"
                value={
                  dashboardData?.aiPerformance.totalFraudAlerts.toString() ||
                  "0"
                }
                status={
                  dashboardData?.aiPerformance.totalFraudAlerts === 0
                    ? "good"
                    : "warning"
                }
              />
              <HealthStat
                label="Resolved Alerts"
                value={
                  dashboardData?.aiPerformance.resolvedAlerts.toString() || "0"
                }
                status="none"
              />
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

const KpiCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  isLive?: boolean;
}> = ({ title, value, icon, color, isLive = false }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{
        borderRadius: 2,
        height: "100%",
        borderTop: `4px solid ${color}`,
        position: "relative",
      }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center" }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            backgroundColor: `${color}10`,
            mr: 2,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        {isLive && (
          <LiveIcon
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              fontSize: 12,
              color: "success.main",
              animation: "pulse 2s ease-in-out infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
            }}
          />
        )}
      </CardContent>
    </Card>
  </Grid>
);

const HealthStat: React.FC<{
  label: string;
  value: string;
  status: "good" | "warning" | "critical" | "none";
}> = ({ label, value, status }) => {
  const getStatusColor = () => {
    switch (status) {
      case "good":
        return "#10B981";
      case "warning":
        return "#F59E0B";
      case "critical":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  return (
    <Grid item xs={6} sm={3}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: getStatusColor(),
            mr: 1,
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
    </Grid>
  );
};
