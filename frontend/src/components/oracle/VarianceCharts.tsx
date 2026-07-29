import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
 scales,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const VarianceCharts: React.FC = () => {
  const { t } = useTranslation();

  const { data: activity, isLoading, error } = useQuery({
    queryKey: ['oracle-activity'],
    queryFn: async () => {
      const response = await fetch('/api/v2/oracle/activity?limit=100');
      if (!response.ok) throw new Error('Failed to fetch activity');
      const result = await response.json();
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="body1" color="error">
          {t('oracleNetwork.analytics.errorLoading')}
        </Typography>
      </Box>
    );
  }

  const submissions = activity?.submissions || [];
  const disputes = activity?.disputes || [];
  const slashEvents = activity?.slashEvents || [];

  // Prepare submission variance data
  const submissionsByNode = submissions.reduce((acc: any, sub: any) => {
    const address = sub.node?.address || 'unknown';
    acc[address] = (acc[address] || 0) + 1;
    return acc;
  }, {});

  const submissionVarianceData = {
    labels: Object.keys(submissionsByNode).map((addr) => `${addr.slice(0, 8)}...`),
    datasets: [
      {
        label: t('oracleNetwork.analytics.submissions'),
        data: Object.values(submissionsByNode),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Prepare dispute status data
  const disputeStatusData = {
    labels: [t('oracleNetwork.analytics.pending'), t('oracleNetwork.analytics.accepted'), t('oracleNetwork.analytics.rejected')],
    datasets: [
      {
        data: [
          disputes.filter((d: any) => d.status === 'pending').length,
          disputes.filter((d: any) => d.status === 'accepted').length,
          disputes.filter((d: any) => d.status === 'rejected').length,
        ],
        backgroundColor: ['rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)', 'rgba(255, 99, 132, 0.5)'],
        borderColor: ['rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
        borderWidth: 1,
      },
    ],
  };

  // Prepare slash reason data
  const slashReasons = slashEvents.reduce((acc: any, event: any) => {
    acc[event.reason] = (acc[event.reason] || 0) + 1;
    return acc;
  }, {});

  const slashReasonData = {
    labels: Object.keys(slashReasons),
    datasets: [
      {
        label: t('oracleNetwork.analytics.slashes'),
        data: Object.values(slashReasons),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <Box role="region" aria-label={t('oracleNetwork.analytics.title')}>
      <Typography variant="h6" gutterBottom id="analytics-title">
        {t('oracleNetwork.analytics.title')}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }} aria-labelledby="analytics-title">
        <Paper sx={{ p: 3 }} role="article" aria-label={t('oracleNetwork.analytics.submissionVariance')}>
          <Typography variant="subtitle1" gutterBottom id="submission-variance-chart">
            {t('oracleNetwork.analytics.submissionVariance')}
          </Typography>
          <Box role="img" aria-label={`${t('oracleNetwork.analytics.submissionVariance')} chart`}>
            <Bar data={submissionVarianceData} options={{ responsive: true, plugins: { legend: { labels: { boxWidth: 12 } } } }} />
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }} role="article" aria-label={t('oracleNetwork.analytics.disputeStatus')}>
          <Typography variant="subtitle1" gutterBottom id="dispute-status-chart">
            {t('oracleNetwork.analytics.disputeStatus')}
          </Typography>
          <Box role="img" aria-label={`${t('oracleNetwork.analytics.disputeStatus')} chart`}>
            <Doughnut data={disputeStatusData} options={{ responsive: true, plugins: { legend: { labels: { boxWidth: 12 } } } }} />
          </Box>
        </Paper>

        <Paper sx={{ p: 3, gridColumn: { xs: '1', md: '1 / -1' } }} role="article" aria-label={t('oracleNetwork.analytics.slashReasons')}>
          <Typography variant="subtitle1" gutterBottom id="slash-reasons-chart">
            {t('oracleNetwork.analytics.slashReasons')}
          </Typography>
          <Box role="img" aria-label={`${t('oracleNetwork.analytics.slashReasons')} chart`}>
            <Bar data={slashReasonData} options={{ responsive: true, plugins: { legend: { labels: { boxWidth: 12 } } } }} />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default VarianceCharts;
