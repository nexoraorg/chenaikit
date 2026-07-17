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
} from "@mui/material";
import {
  TrendingUp,
  Assessment,
  Public,
  BugReport,
  Download,
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../i18n/config';
import { UsageChart } from './charts/UsageChart';
import { DistributionChart } from './charts/DistributionChart';

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [timeRange, setTimeRange] = useState("30");

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
      setError(t('analytics.fetchError', { defaultValue: 'Failed to fetch analytics data. Please ensure the backend is running.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    window.open(
      `/api/v1/analytics/export?format=${format}&days=${timeRange}`,
      "_blank",
    );
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <CircularProgress size={60} />
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 4 }}>
      <Alert severity="error">{error}</Alert>
      <Button onClick={fetchData} sx={{ mt: 2 }} variant="contained">{t('app.retry')}</Button>
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
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {t('analytics.title')}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
            {t('analytics.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{t('analytics.timeRange')}</InputLabel>
            <Select value={timeRange} label={t('analytics.timeRange')} onChange={(e) => setTimeRange(e.target.value)}>
              <MenuItem value="7">{t('analytics.last7Days')}</MenuItem>
              <MenuItem value="30">{t('analytics.last30Days')}</MenuItem>
              <MenuItem value="90">{t('analytics.last90Days')}</MenuItem>
            </Select>
          </FormControl>
          <Button startIcon={<Download />} variant="outlined" onClick={() => handleExport('csv')}>
            {t('analytics.downloadCsv')}
          </Button>
          <Button startIcon={<Download />} variant="contained" onClick={() => handleExport('pdf')}>
            {t('analytics.downloadPdf')}
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <KpiCard 
          title={t('analytics.totalRequests', { defaultValue: 'Total Requests' })} 
          value={dashboardData ? formatNumber(dashboardData.systemUsage.totalRequests) : '0'} 
          icon={<Assessment color="primary" />} 
          color="#3B82F6"
        />
        <KpiCard 
          title={t('analytics.avgLatency', { defaultValue: 'Avg Latency' })} 
          value={dashboardData ? `${formatNumber(dashboardData.systemUsage.avgLatency)}ms` : '0ms'} 
          icon={<TrendingUp sx={{ color: '#10B981' }} />} 
          color="#10B981"
        />
        <KpiCard 
          title={t('analytics.avgCreditScore', { defaultValue: 'Avg Credit Score' })} 
          value={dashboardData ? formatNumber(dashboardData.aiPerformance.avgCreditScore) : '0'} 
          icon={<BugReport color="warning" />} 
          color="#F59E0B"
        />
        <KpiCard 
          title={t('analytics.blockchainVol', { defaultValue: 'Blockchain Vol' })} 
          value={dashboardData ? formatNumber(dashboardData.blockchainActivity.totalVolume) : '0'} 
          icon={<Public color="secondary" />} 
          color="#8B5CF6"
        />
      </Grid>

      <Grid container spacing={3}>
        {/* Main Trend Chart */}
        <Grid item xs={12} lg={8}>
          {trendData && (
            <UsageChart 
              data={trendData.history} 
              forecast={trendData.forecast} 
              title={t('analytics.systemTrafficForecast', { defaultValue: 'System Traffic & Forecast' })} 
            />
          )}
        </Grid>

        {/* AI Distribution Chart */}
        <Grid item xs={12} md={6} lg={4}>
          {dashboardData && (
            <DistributionChart 
              data={dashboardData.aiPerformance.riskDistribution} 
              title={t('analytics.riskDistribution')} 
            />
          )}
        </Grid>

        {/* Asset Distribution */}
        <Grid item xs={12} md={6} lg={4}>
          {dashboardData && (
            <DistributionChart 
              data={dashboardData.blockchainActivity.assetDistribution} 
              title={t('analytics.blockchainAssets', { defaultValue: 'Blockchain Assets' })} 
            />
          )}
        </Grid>

        {/* System Health Summary */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
              {t('dashboard.systemHealth')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <HealthStat label={t('analytics.successRate', { defaultValue: 'Success Rate' })} value={dashboardData ? `${formatNumber(dashboardData.systemUsage.successRate)}%` : '0%'} status={dashboardData?.systemUsage.successRate && dashboardData.systemUsage.successRate > 95 ? 'good' : 'warning'} />
              <HealthStat label={t('analytics.errorRate', { defaultValue: 'Error Rate' })} value={dashboardData ? `${formatNumber(dashboardData.systemUsage.errorRate)}%` : '0%'} status={dashboardData?.systemUsage.errorRate && dashboardData.systemUsage.errorRate < 5 ? 'good' : 'critical'} />
              <HealthStat label={t('analytics.fraudAlerts', { defaultValue: 'Fraud Alerts' })} value={dashboardData ? formatNumber(dashboardData.aiPerformance.totalFraudAlerts) : '0'} status={dashboardData?.aiPerformance.totalFraudAlerts === 0 ? 'good' : 'warning'} />
              <HealthStat label={t('analytics.resolvedAlerts', { defaultValue: 'Resolved Alerts' })} value={dashboardData ? formatNumber(dashboardData.aiPerformance.resolvedAlerts) : '0'} status="none" />
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
}> = ({ title, value, icon, color }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{ borderRadius: 2, height: "100%", borderTop: `4px solid ${color}` }}
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
      </CardContent>
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
