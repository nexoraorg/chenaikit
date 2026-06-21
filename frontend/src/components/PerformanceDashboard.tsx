import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fade,
  Snackbar,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  FiberManualRecord as LiveIcon,
} from "@mui/icons-material";
import { useWebSocket } from "./WebSocketProvider";
import { ConnectionStatus } from "./ConnectionStatus";
import ExportButton from "./ExportButton";
import {
  exportToCSV,
  exportToJSON,
  exportToExcel,
  exportToPDF,
  ExportMetadata,
  ChartElement,
} from "../utils/exportUtils";

// Performance data types
interface PerformanceMetrics {
  api: {
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  frontend: {
    lighthouseScore: number;
    bundleSize: number;
    fcp: number;
    lcp: number;
    cls: number;
    fid: number;
  };
  database: {
    avgQueryTime: number;
    p95QueryTime: number;
    indexUsage: number;
    cacheHitRate: number;
  };
  contracts: {
    avgGasUsage: number;
    maxGasUsage: number;
    avgExecutionTime: number;
  };
}

interface PerformanceIssue {
  type: string;
  actual: number;
  threshold: number;
  severity: "high" | "medium" | "low";
  description: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`performance-tabpanel-${index}`}
      aria-labelledby={`performance-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const PerformanceDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [issues, setIssues] = useState<PerformanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hasUpdate, setHasUpdate] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const metricsRef = useRef<HTMLDivElement>(null);

  const { subscribe, isPaused } = useWebSocket();

  // Performance thresholds
  const thresholds = {
    api: {
      avgResponseTime: 200,
      p95ResponseTime: 500,
      errorRate: 0.1,
      throughput: 1000,
    },
    frontend: {
      lighthouseScore: 90,
      bundleSize: 1024 * 1024, // 1MB
      fcp: 1500,
      lcp: 2500,
      cls: 0.1,
      fid: 100,
    },
    database: {
      avgQueryTime: 100,
      p95QueryTime: 200,
      indexUsage: 95,
      cacheHitRate: 90,
    },
    contracts: {
      avgGasUsage: 50000,
      maxGasUsage: 100000,
      avgExecutionTime: 1000,
    },
  };

  // Fetch performance data
  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      // Mock API call - replace with actual endpoint
      const response = await fetch("/api/performance/metrics");
      const data = await response.json();

      setMetrics(data.metrics);
      setIssues(data.issues || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching performance data:", error);
      // Set mock data for demonstration
      const mockMetrics: PerformanceMetrics = {
        api: {
          avgResponseTime: 180,
          p95ResponseTime: 450,
          errorRate: 0.05,
          throughput: 1200,
        },
        frontend: {
          lighthouseScore: 92,
          bundleSize: 950 * 1024, // 950KB
          fcp: 1200,
          lcp: 2000,
          cls: 0.08,
          fid: 80,
        },
        database: {
          avgQueryTime: 85,
          p95QueryTime: 180,
          indexUsage: 97,
          cacheHitRate: 92,
        },
        contracts: {
          avgGasUsage: 45000,
          maxGasUsage: 80000,
          avgExecutionTime: 800,
        },
      };

      setMetrics(mockMetrics);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchPerformanceData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to real-time performance metrics updates
  useEffect(() => {
    const unsubscribe = subscribe("performanceMetrics", (data) => {
      if (isPaused) return;

      setMetrics((prev) => {
        if (!prev) return data.metrics || prev;

        return {
          api: { ...prev.api, ...(data.metrics?.api || {}) },
          frontend: { ...prev.frontend, ...(data.metrics?.frontend || {}) },
          database: { ...prev.database, ...(data.metrics?.database || {}) },
          contracts: { ...prev.contracts, ...(data.metrics?.contracts || {}) },
        };
      });

      if (data.issues) {
        setIssues(data.issues);
      }

      setLastUpdated(new Date());
      setHasUpdate(true);
      setTimeout(() => setHasUpdate(false), 1500);
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe, isPaused]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getStatusColor = (
    value: number,
    threshold: number,
    inverse = false,
  ) => {
    const ratio = value / threshold;
    if (inverse) {
      return ratio >= 1 ? "success" : ratio >= 0.8 ? "warning" : "error";
    } else {
      return ratio <= 1 ? "success" : ratio <= 1.2 ? "warning" : "error";
    }
  };

  const getProgressColor = (
    value: number,
    threshold: number,
    inverse = false,
  ) => {
    const ratio = value / threshold;
    if (inverse) {
      return ratio >= 1 ? "#4caf50" : ratio >= 0.8 ? "#ff9800" : "#f44336";
    } else {
      return ratio <= 1 ? "#4caf50" : ratio <= 1.2 ? "#ff9800" : "#f44336";
    }
  };

  const getStatusIcon = (value: number, threshold: number, inverse = false) => {
    const ratio = value / threshold;
    if (inverse) {
      if (ratio >= 1) return <CheckCircleIcon color="success" />;
      if (ratio >= 0.8) return <WarningIcon color="warning" />;
      return <ErrorIcon color="error" />;
    } else {
      if (ratio <= 1) return <CheckCircleIcon color="success" />;
      if (ratio <= 1.2) return <WarningIcon color="warning" />;
      return <ErrorIcon color="error" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Prepare export data
  const prepareExportData = () => {
    if (!metrics) return [];

    const data = [
      // API Metrics
      {
        Category: "API Performance",
        Metric: "Avg Response Time (ms)",
        Value: metrics.api.avgResponseTime,
        Threshold: thresholds.api.avgResponseTime,
        Status: getStatusColor(
          metrics.api.avgResponseTime,
          thresholds.api.avgResponseTime,
        ),
      },
      {
        Category: "API Performance",
        Metric: "95th Percentile (ms)",
        Value: metrics.api.p95ResponseTime,
        Threshold: thresholds.api.p95ResponseTime,
        Status: getStatusColor(
          metrics.api.p95ResponseTime,
          thresholds.api.p95ResponseTime,
        ),
      },
      {
        Category: "API Performance",
        Metric: "Error Rate (%)",
        Value: metrics.api.errorRate,
        Threshold: thresholds.api.errorRate,
        Status: getStatusColor(metrics.api.errorRate, thresholds.api.errorRate),
      },
      {
        Category: "API Performance",
        Metric: "Throughput (RPS)",
        Value: metrics.api.throughput,
        Threshold: thresholds.api.throughput,
        Status: getStatusColor(
          metrics.api.throughput,
          thresholds.api.throughput,
          true,
        ),
      },
      // Frontend Metrics
      {
        Category: "Frontend Performance",
        Metric: "Lighthouse Score",
        Value: metrics.frontend.lighthouseScore,
        Threshold: thresholds.frontend.lighthouseScore,
        Status: getStatusColor(
          metrics.frontend.lighthouseScore,
          thresholds.frontend.lighthouseScore,
          true,
        ),
      },
      {
        Category: "Frontend Performance",
        Metric: "Bundle Size",
        Value: formatBytes(metrics.frontend.bundleSize),
        Threshold: formatBytes(thresholds.frontend.bundleSize),
        Status: getStatusColor(
          metrics.frontend.bundleSize,
          thresholds.frontend.bundleSize,
        ),
      },
      {
        Category: "Frontend Performance",
        Metric: "First Contentful Paint (ms)",
        Value: metrics.frontend.fcp,
        Threshold: thresholds.frontend.fcp,
        Status: getStatusColor(metrics.frontend.fcp, thresholds.frontend.fcp),
      },
      {
        Category: "Frontend Performance",
        Metric: "Largest Contentful Paint (ms)",
        Value: metrics.frontend.lcp,
        Threshold: thresholds.frontend.lcp,
        Status: getStatusColor(metrics.frontend.lcp, thresholds.frontend.lcp),
      },
      // Database Metrics
      {
        Category: "Database Performance",
        Metric: "Avg Query Time (ms)",
        Value: metrics.database.avgQueryTime,
        Threshold: thresholds.database.avgQueryTime,
        Status: getStatusColor(
          metrics.database.avgQueryTime,
          thresholds.database.avgQueryTime,
        ),
      },
      {
        Category: "Database Performance",
        Metric: "Cache Hit Rate (%)",
        Value: metrics.database.cacheHitRate,
        Threshold: thresholds.database.cacheHitRate,
        Status: getStatusColor(
          metrics.database.cacheHitRate,
          thresholds.database.cacheHitRate,
          true,
        ),
      },
      // Contract Metrics
      {
        Category: "Smart Contracts",
        Metric: "Avg Gas Usage",
        Value: metrics.contracts.avgGasUsage,
        Threshold: thresholds.contracts.avgGasUsage,
        Status: getStatusColor(
          metrics.contracts.avgGasUsage,
          thresholds.contracts.avgGasUsage,
        ),
      },
      {
        Category: "Smart Contracts",
        Metric: "Avg Execution Time (ms)",
        Value: metrics.contracts.avgExecutionTime,
        Threshold: thresholds.contracts.avgExecutionTime,
        Status: getStatusColor(
          metrics.contracts.avgExecutionTime,
          thresholds.contracts.avgExecutionTime,
        ),
      },
    ];

    return data;
  };

  // Handle export
  const handleExport = async (format: "csv" | "json" | "pdf" | "excel") => {
    if (!metrics) {
      setSnackbarMessage("No data available to export");
      setSnackbarOpen(true);
      return;
    }

    try {
      const data = prepareExportData();
      const metadata: ExportMetadata = {
        exportDate: new Date(),
        source: "Performance Dashboard",
        filters: { lastUpdated: lastUpdated.toISOString() },
      };

      switch (format) {
        case "csv":
          exportToCSV(data, { metadata });
          break;
        case "json":
          exportToJSON({ metrics, issues, thresholds }, { metadata });
          break;
        case "excel":
          exportToExcel(data, {
            metadata,
            sheetName: "Performance Metrics",
          });
          break;
        case "pdf":
          const charts: ChartElement[] = [];
          if (metricsRef.current) {
            charts.push({
              element: metricsRef.current,
              title: "Performance Metrics Overview",
            });
          }
          await exportToPDF(data, charts, { metadata });
          break;
      }

      setSnackbarMessage(`Exported successfully as ${format.toUpperCase()}`);
      setSnackbarOpen(true);
    } catch (error: any) {
      setSnackbarMessage("Export failed. Please try again.");
      setSnackbarOpen(true);
    }
  };

  const renderMetricCard = (
    title: string,
    value: number,
    threshold: number,
    unit: string,
    inverse = false,
  ) => {
    const color = getStatusColor(value, threshold, inverse);
    const progressColor = getProgressColor(value, threshold, inverse);
    const icon = getStatusIcon(value, threshold, inverse);
    const progressValue = Math.min((value / threshold) * 100, 200);

    return (
      <Card sx={{ height: "100%" }}>
        <CardContent>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <Typography variant="h6" color="textSecondary">
              {title}
            </Typography>
            {icon}
          </Box>
          <Typography variant="h4" component="div" color={color} mb={1}>
            {value.toLocaleString()} {unit}
          </Typography>
          <Typography variant="body2" color="textSecondary" mb={2}>
            Target: {threshold.toLocaleString()} {unit}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progressValue}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "grey.300",
              "& .MuiLinearProgress-bar": {
                backgroundColor: progressColor,
              },
            }}
          />
        </CardContent>
      </Card>
    );
  };

  const renderAPIMetrics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Avg Response Time",
          metrics?.api.avgResponseTime || 0,
          thresholds.api.avgResponseTime,
          "ms",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "95th Percentile",
          metrics?.api.p95ResponseTime || 0,
          thresholds.api.p95ResponseTime,
          "ms",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Error Rate",
          metrics?.api.errorRate || 0,
          thresholds.api.errorRate,
          "%",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Throughput",
          metrics?.api.throughput || 0,
          thresholds.api.throughput,
          "RPS",
          true,
        )}
      </Grid>
    </Grid>
  );

  const renderFrontendMetrics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Lighthouse Score",
          metrics?.frontend.lighthouseScore || 0,
          thresholds.frontend.lighthouseScore,
          "",
          true,
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Bundle Size",
          metrics?.frontend.bundleSize || 0,
          thresholds.frontend.bundleSize,
          "B",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "First Contentful Paint",
          metrics?.frontend.fcp || 0,
          thresholds.frontend.fcp,
          "ms",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Largest Contentful Paint",
          metrics?.frontend.lcp || 0,
          thresholds.frontend.lcp,
          "ms",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Cumulative Layout Shift",
          metrics?.frontend.cls || 0,
          thresholds.frontend.cls,
          "",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "First Input Delay",
          metrics?.frontend.fid || 0,
          thresholds.frontend.fid,
          "ms",
        )}
      </Grid>
    </Grid>
  );

  const renderDatabaseMetrics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Avg Query Time",
          metrics?.database.avgQueryTime || 0,
          thresholds.database.avgQueryTime,
          "ms",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "95th Percentile",
          metrics?.database.p95QueryTime || 0,
          thresholds.database.p95QueryTime,
          "ms",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Index Usage",
          metrics?.database.indexUsage || 0,
          thresholds.database.indexUsage,
          "%",
          true,
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        {renderMetricCard(
          "Cache Hit Rate",
          metrics?.database.cacheHitRate || 0,
          thresholds.database.cacheHitRate,
          "%",
          true,
        )}
      </Grid>
    </Grid>
  );

  const renderContractMetrics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={4}>
        {renderMetricCard(
          "Avg Gas Usage",
          metrics?.contracts.avgGasUsage || 0,
          thresholds.contracts.avgGasUsage,
          "gas",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        {renderMetricCard(
          "Max Gas Usage",
          metrics?.contracts.maxGasUsage || 0,
          thresholds.contracts.maxGasUsage,
          "gas",
        )}
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        {renderMetricCard(
          "Avg Execution Time",
          metrics?.contracts.avgExecutionTime || 0,
          thresholds.contracts.avgExecutionTime,
          "ms",
        )}
      </Grid>
    </Grid>
  );

  const renderIssuesTable = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Severity</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Actual</TableCell>
            <TableCell>Threshold</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {issues.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Box py={4}>
                  <CheckCircleIcon
                    color="success"
                    sx={{ fontSize: 48, mb: 2 }}
                  />
                  <Typography variant="h6" color="textSecondary">
                    No performance issues detected
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            issues.map((issue, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Chip
                    label={issue.severity}
                    color={
                      issue.severity === "high"
                        ? "error"
                        : issue.severity === "medium"
                          ? "warning"
                          : "info"
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>{issue.type}</TableCell>
                <TableCell>{issue.description}</TableCell>
                <TableCell>{issue.actual.toLocaleString()}</TableCell>
                <TableCell>{issue.threshold.toLocaleString()}</TableCell>
                <TableCell>
                  <Tooltip
                    title={`Ratio: ${(issue.actual / issue.threshold).toFixed(2)}`}
                  >
                    {issue.actual > issue.threshold ? (
                      <TrendingUpIcon color="error" />
                    ) : (
                      <TrendingDownIcon color="success" />
                    )}
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="400px"
      >
        <Typography variant="h6">Loading performance metrics...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          Performance Dashboard
          <Fade in={hasUpdate}>
            <LiveIcon
              sx={{
                fontSize: 16,
                color: "success.main",
                animation: "pulse 1s ease-in-out",
              }}
            />
          </Fade>
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <ConnectionStatus showControls={true} size="small" />
          <Typography variant="body2" color="textSecondary">
            Last updated: {lastUpdated.toLocaleString()}
          </Typography>
          <ExportButton
            onExport={handleExport}
            variant="contained"
            size="small"
          />
          <Tooltip title="Refresh metrics">
            <IconButton onClick={fetchPerformanceData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {issues.filter((i) => i.severity === "high").length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Critical Performance Issues Detected
          </Typography>
          {issues
            .filter((i) => i.severity === "high")
            .map((issue, index) => (
              <Typography key={index} variant="body2">
                • {issue.type}: {issue.description}
              </Typography>
            ))}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Performance tabs"
        >
          <Tab label="API Performance" />
          <Tab label="Frontend Performance" />
          <Tab label="Database Performance" />
          <Tab label="Smart Contracts" />
          <Tab label="Issues & Alerts" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <div ref={metricsRef}>{renderAPIMetrics()}</div>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {renderFrontendMetrics()}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {renderDatabaseMetrics()}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {renderContractMetrics()}
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        {renderIssuesTable()}
      </TabPanel>

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

export default PerformanceDashboard;
