import React, { useState, useEffect } from "react";
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
  Stack,
  Snackbar,
} from "@mui/material";
import {
  TrendingUp,
  Assessment,
  Public,
  BugReport,
  Download,
  CheckCircle,
  Error as ErrorIcon,
} from "@mui/icons-material";
import axios from "axios";
import { UsageChart } from "./charts/UsageChart";
import { DistributionChart } from "./charts/DistributionChart";
import {
  useTransactionUpdates,
  useMetricsUpdates,
} from "../hooks/useWebSocket";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { UpdateControlButton } from "./UpdateControlButton";
import { LiveDataIndicator } from "./LiveDataIndicator";
import ExportButton from "./ExportButton";
import ExportModal from "./ExportModal";
import {
  exportDashboard,
  ExportFormat,
  ExportOptions,
  ProgressCallback,
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

  // Export state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Real-time hooks
  const { latestTransaction, recentTransactions } = useTransactionUpdates(500);
  const realtimeMetrics = useMetricsUpdates(1000);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
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
  };

  // Update dashboard data with real-time metrics
  useEffect(() => {
    if (realtimeMetrics && dashboardData) {
      setDashboardData((prev) =>
        prev
          ? {
              ...prev,
              systemUsage: {
                ...prev.systemUsage,
                totalRequests: realtimeMetrics.totalRequests,
                avgLatency: realtimeMetrics.avgLatency,
                errorRate: realtimeMetrics.errorRate,
                successRate: realtimeMetrics.successRate,
              },
            }
          : null,
      );
    }
  }, [realtimeMetrics]);

  // Update transaction count with real-time data
  useEffect(() => {
    if (latestTransaction && dashboardData) {
      setDashboardData((prev) =>
        prev
          ? {
              ...prev,
              blockchainActivity: {
                ...prev.blockchainActivity,
                totalTxCount: prev.blockchainActivity.totalTxCount + 1,
              },
            }
          : null,
      );
    }
  }, [latestTransaction]);

  const handleExport = async (format: "csv" | "pdf") => {
    window.open(
      `/api/v1/analytics/export?format=${format}&days=${timeRange}`,
      "_blank",
    );
  };

  // Prepare export data from dashboard
  const exportData = useMemo(() => {
    if (!dashboardData || !trendData) return [];

    const exportRecords = [
      {
        category: "System Usage",
        metric: "Total Requests",
        value: dashboardData.systemUsage.totalRequests,
        timestamp: new Date().toISOString(),
      },
      {
        category: "System Usage",
        metric: "Average Latency (ms)",
        value: dashboardData.systemUsage.avgLatency.toFixed(2),
        timestamp: new Date().toISOString(),
      },
      {
        category: "System Usage",
        metric: "Error Rate (%)",
        value: dashboardData.systemUsage.errorRate.toFixed(2),
        timestamp: new Date().toISOString(),
      },
      {
        category: "System Usage",
        metric: "Success Rate (%)",
        value: dashboardData.systemUsage.successRate.toFixed(2),
        timestamp: new Date().toISOString(),
      },
      {
        category: "AI Performance",
        metric: "Average Credit Score",
        value: dashboardData.aiPerformance.avgCreditScore.toFixed(2),
        timestamp: new Date().toISOString(),
      },
      {
        category: "AI Performance",
        metric: "Total Fraud Alerts",
        value: dashboardData.aiPerformance.totalFraudAlerts,
        timestamp: new Date().toISOString(),
      },
      {
        category: "AI Performance",
        metric: "Resolved Alerts",
        value: dashboardData.aiPerformance.resolvedAlerts,
        timestamp: new Date().toISOString(),
      },
      {
        category: "Blockchain Activity",
        metric: "Total Transactions",
        value: dashboardData.blockchainActivity.totalTxCount,
        timestamp: new Date().toISOString(),
      },
      {
        category: "Blockchain Activity",
        metric: "Total Volume",
        value: dashboardData.blockchainActivity.totalVolume,
        timestamp: new Date().toISOString(),
      },
      ...trendData.history.map((item) => ({
        category: "Trend History",
        metric: "Value",
        value: item.value,
        date: item.date,
        timestamp: new Date().toISOString(),
      })),
    ];

    return exportRecords;
  }, [dashboardData, trendData]);

  const handleExportModal = async (
    format: ExportFormat,
    options: ExportOptions,
  ) => {
    try {
      setExporting(true);
      setExportError(null);
      setExportProgress(0);

      const progressCallback: ProgressCallback = (progress, message) => {
        setExportProgress(progress);
      };

      if (format === "pdf") {
        // For PDF export, pass the element ID
        await exportDashboard(
          format,
          exportData,
          {
            ...options,
            metadata: {
              ...options.metadata,
              elementId: "analytics-dashboard-container",
              title: "Analytics Dashboard Report",
            },
          },
          progressCallback,
        );
      } else {
        await exportDashboard(format, exportData, options, progressCallback);
      }

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
      }, 4000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export dashboard";
      setExportError(message);
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
      setExportProgress(0);
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
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: "text.primary" }}
          >
            Business Intelligence Dashboard
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "text.secondary" }}>
            Real-time insights across systems, AI, and blockchain
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <UpdateControlButton size="medium" />
          <ConnectionStatusBadge variant="compact" />
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

      {/* Real-time activity summary */}
      {recentTransactions.length > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            bgcolor: "#ECFDF5",
            borderLeft: "4px solid #10B981",
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Box>
              <Typography
                variant="subtitle2"
                color="success.dark"
                sx={{ fontWeight: 600 }}
              >
                ✓ Real-time Data Active
              </Typography>
              <Typography variant="caption" color="success.dark">
                Last update: {new Date().toLocaleTimeString()} •{" "}
                {recentTransactions.length} transactions received
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <SkeletonCard lines={2} />
            </Grid>
          ))
        ) : (
          <>
            <KpiCard
              title="Total Requests"
              value={
                dashboardData?.systemUsage.totalRequests.toLocaleString() || "0"
              }
              icon={<Assessment color="primary" />}
              color="#3B82F6"
            />
            <KpiCard
              title="Avg Latency"
              value={
                `${dashboardData?.systemUsage.avgLatency.toFixed(2)}ms` || "0ms"
              }
              icon={<TrendingUp sx={{ color: "#10B981" }} />}
              color="#10B981"
            />
            <KpiCard
              title="Avg Credit Score"
              value={
                dashboardData?.aiPerformance.avgCreditScore.toFixed(0) || "0"
              }
              icon={<BugReport color="warning" />}
              color="#F59E0B"
            />
            <KpiCard
              title="Blockchain Vol"
              value={
                dashboardData?.blockchainActivity.totalVolume.toLocaleString() ||
                "0"
              }
              icon={<Public color="secondary" />}
              color="#8B5CF6"
            />
          </>
        )}
      </Grid>

      <Grid container spacing={3}>
        {/* Main Trend Chart */}
        <Grid item xs={12} lg={8}>
          {loading ? (
            <SkeletonChart height={350} />
          ) : (
            trendData && (
              <UsageChart
                data={trendData.history}
                forecast={trendData.forecast}
                title="System Traffic & Forecast"
              />
            )
          )}
        </Grid>

        {/* AI Distribution Chart */}
        <Grid item xs={12} md={6} lg={4}>
          {loading ? (
            <SkeletonChart height={300} />
          ) : (
            dashboardData && (
              <DistributionChart
                data={dashboardData.aiPerformance.riskDistribution}
                title="Risk Level Distribution"
              />
            )
          )}
        </Grid>

        {/* Asset Distribution */}
        <Grid item xs={12} md={6} lg={4}>
          {loading ? (
            <SkeletonChart height={300} />
          ) : (
            dashboardData && (
              <DistributionChart
                data={dashboardData.blockchainActivity.assetDistribution}
                title="Blockchain Assets"
              />
            )
          )}
        </Grid>

        {/* System Health Summary */}
        <Grid item xs={12} lg={8}>
          {loading ? (
            <SkeletonCard lines={4} />
          ) : (
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
                    dashboardData?.aiPerformance.resolvedAlerts.toString() ||
                    "0"
                  }
                  status="none"
                />
              </Grid>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportError(null);
        }}
        onExport={handleExportModal}
        loading={exporting}
        error={exportError}
      />

      {/* Success Notification */}
      <Snackbar
        open={exportSuccess}
        autoHideDuration={4000}
        onClose={() => setExportSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setExportSuccess(false)}
          severity="success"
          sx={{ width: "100%" }}
          icon={<CheckCircle />}
        >
          Data exported successfully!
        </Alert>
      </Snackbar>

      {/* Error Notification */}
      <Snackbar
        open={!!exportError}
        autoHideDuration={6000}
        onClose={() => setExportError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setExportError(null)}
          severity="error"
          sx={{ width: "100%" }}
          icon={<ErrorIcon />}
        >
          {exportError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const KpiCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  isRealtime?: boolean;
}> = ({ title, value, icon, color, isRealtime }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{
        borderRadius: 2,
        height: "100%",
        borderTop: `4px solid ${color}`,
        position: "relative",
        overflow: "visible",
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
        <Box>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        {isRealtime && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#EF4444",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        )}
      </CardContent>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Card>
  </Grid>
);

const HealthStat: React.FC<{
  label: string;
  value: string;
  status: "good" | "warning" | "critical" | "none";
}> = ({ label, value, status }) => {
  const statusLabels = {
    good: "Healthy",
    warning: "Needs attention",
    critical: "Critical",
    none: "Informational",
  } as const;

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
      <Box
        sx={{ display: "flex", alignItems: "center", mt: 0.5 }}
        aria-label={`${label}: ${value}. Status: ${statusLabels[status]}`}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: getStatusColor(),
            mr: 1,
          }}
        />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
        <Typography component="span" className="sr-only">
          {` (${statusLabels[status]})`}
        </Typography>
      </Box>
    </Grid>
  );
};
