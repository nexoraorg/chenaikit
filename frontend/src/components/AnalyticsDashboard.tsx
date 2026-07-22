import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Grid,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Paper,
  Fade,
  Snackbar,
} from "@mui/material";
import {
  TrendingUp,
  Assessment,
  Public,
  BugReport,
  FiberManualRecord as LiveIcon,
  FileDownload as FileDownloadIcon,
} from "@mui/icons-material";
import axios from "axios";
import { UsageChart } from "./charts/UsageChart";
import { DistributionChart } from "./charts/DistributionChart";
import { useWebSocket } from "./WebSocketProvider";
import { ConnectionStatus } from "./ConnectionStatus";
import ExportButton from "./ExportButton";
import ExportModal, { ExportConfig } from "./ExportModal";
import {
  exportToCSV,
  exportToJSON,
  exportToExcel,
  exportToPDF,
  ExportMetadata,
  ChartElement,
} from "../utils/exportUtils";

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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Refs for chart elements (for PDF export)
  const usageChartRef = useRef<HTMLDivElement>(null);
  const riskChartRef = useRef<HTMLDivElement>(null);
  const assetChartRef = useRef<HTMLDivElement>(null);

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

  // Prepare export data
  const prepareExportData = useCallback(() => {
    if (!dashboardData) return [];

    const data = [
      {
        Category: "System Usage",
        Metric: "Total Requests",
        Value: dashboardData.systemUsage.totalRequests,
      },
      {
        Category: "System Usage",
        Metric: "Avg Latency (ms)",
        Value: dashboardData.systemUsage.avgLatency.toFixed(2),
      },
      {
        Category: "System Usage",
        Metric: "Error Rate (%)",
        Value: dashboardData.systemUsage.errorRate.toFixed(2),
      },
      {
        Category: "System Usage",
        Metric: "Success Rate (%)",
        Value: dashboardData.systemUsage.successRate.toFixed(2),
      },
      {
        Category: "AI Performance",
        Metric: "Avg Credit Score",
        Value: dashboardData.aiPerformance.avgCreditScore,
      },
      {
        Category: "AI Performance",
        Metric: "Total Fraud Alerts",
        Value: dashboardData.aiPerformance.totalFraudAlerts,
      },
      {
        Category: "AI Performance",
        Metric: "Resolved Alerts",
        Value: dashboardData.aiPerformance.resolvedAlerts,
      },
      {
        Category: "Blockchain Activity",
        Metric: "Total Transactions",
        Value: dashboardData.blockchainActivity.totalTxCount,
      },
      {
        Category: "Blockchain Activity",
        Metric: "Total Volume",
        Value: dashboardData.blockchainActivity.totalVolume,
      },
    ];

    // Add trend data if available
    if (trendData?.history) {
      trendData.history.forEach((item) => {
        data.push({
          Category: "Historical Trends",
          Metric: `Traffic on ${item.date}`,
          Value: item.value,
        });
      });
    }

    return data;
  }, [dashboardData, trendData]);

  // Quick export handler
  const handleQuickExport = async (
    format: "csv" | "json" | "pdf" | "excel",
  ) => {
    if (!dashboardData) {
      setSnackbarMessage("No data available to export");
      setSnackbarOpen(true);
      return;
    }

    try {
      const data = prepareExportData();
      const metadata: ExportMetadata = {
        exportDate: new Date(),
        source: "Analytics Dashboard",
        filters: { timeRange: `${timeRange} days` },
      };

      switch (format) {
        case "csv":
          exportToCSV(data, {
            metadata,
            onProgress: setExportProgress,
          });
          break;
        case "json":
          exportToJSON(
            { dashboardData, trendData },
            {
              metadata,
              onProgress: setExportProgress,
            },
          );
          break;
        case "excel":
          exportToExcel(data, {
            metadata,
            sheetName: "Analytics",
            onProgress: setExportProgress,
          });
          break;
        case "pdf":
          const charts: ChartElement[] = [];
          if (usageChartRef.current) {
            charts.push({
              element: usageChartRef.current,
              title: "System Traffic & Forecast",
            });
          }
          if (riskChartRef.current) {
            charts.push({
              element: riskChartRef.current,
              title: "Risk Level Distribution",
            });
          }
          if (assetChartRef.current) {
            charts.push({
              element: assetChartRef.current,
              title: "Blockchain Assets",
            });
          }

          await exportToPDF(data, charts, {
            metadata,
          });
          break;
      }

      setSnackbarMessage(`Exported successfully as ${format.toUpperCase()}`);
      setSnackbarOpen(true);
    } catch (error: any) {
      setSnackbarMessage("Export failed. Please try again.");
      setSnackbarOpen(true);
    }
  };

  // Advanced export handler (from modal)
  const handleAdvancedExport = async (config: ExportConfig) => {
    if (!dashboardData) {
      throw new Error("No data available to export");
    }

    const data = prepareExportData();
    const metadata: ExportMetadata = {
      exportDate: new Date(),
      dateRange: config.dateRange,
      source: "Analytics Dashboard",
      filters: {
        timeRange: `${timeRange} days`,
        datasets: config.datasets,
      },
    };

    const options = {
      filename: config.filename,
      metadata: config.includeMetadata ? metadata : undefined,
    };

    switch (config.format) {
      case "csv":
        exportToCSV(data, options);
        break;
      case "json":
        exportToJSON({ dashboardData, trendData }, options);
        break;
      case "excel":
        exportToExcel(data, { ...options, sheetName: "Analytics" });
        break;
      case "pdf":
        const charts: ChartElement[] = [];
        if (config.includeCharts) {
          if (usageChartRef.current) {
            charts.push({
              element: usageChartRef.current,
              title: "System Traffic & Forecast",
            });
          }
          if (riskChartRef.current) {
            charts.push({
              element: riskChartRef.current,
              title: "Risk Level Distribution",
            });
          }
          if (assetChartRef.current) {
            charts.push({
              element: assetChartRef.current,
              title: "Blockchain Assets",
            });
          }
        }
        await exportToPDF(data, charts, options);
        break;
    }
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
          <ExportButton
            onExport={handleQuickExport}
            variant="contained"
            size="medium"
          />
          <Button
            startIcon={<FileDownloadIcon />}
            variant="outlined"
            onClick={() => setExportModalOpen(true)}
            size="medium"
          >
            Advanced Export
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
          <div ref={usageChartRef}>
            {trendData && (
              <UsageChart
                data={trendData.history}
                forecast={trendData.forecast}
                title="System Traffic & Forecast"
              />
            )}
          </div>
        </Grid>

        {/* AI Distribution Chart */}
        <Grid item xs={12} md={6} lg={4}>
          <div ref={riskChartRef}>
            {dashboardData && (
              <DistributionChart
                data={dashboardData.aiPerformance.riskDistribution}
                title="Risk Level Distribution"
              />
            )}
          </div>
        </Grid>

        {/* Asset Distribution */}
        <Grid item xs={12} md={6} lg={4}>
          <div ref={assetChartRef}>
            {dashboardData && (
              <DistributionChart
                data={dashboardData.blockchainActivity.assetDistribution}
                title="Blockchain Assets"
              />
            )}
          </div>
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

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleAdvancedExport}
        title="Export Analytics Dashboard"
        availableDatasets={[
          "System Usage",
          "AI Performance",
          "Blockchain Activity",
          "Historical Trends",
        ]}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
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
