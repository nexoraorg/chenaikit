import React from 'react';
import { Box, Grid, Container, Typography, Button, useTheme, useMediaQuery } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import CreditScoreCard from './CreditScoreCard';
import ScoreHistoryChart from './ScoreHistoryChart';
import RiskFactorsList from './RiskFactorsList';
import { useCreditScore } from '../hooks/useCreditScore';

export interface CreditScoreDashboardProps {
  accountId?: string;
  userId?: string;
  mockData?: boolean;
}

export const CreditScoreDashboard: React.FC<CreditScoreDashboardProps> = ({
  accountId,
  userId,
  mockData = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { data, loading, error, refetch } = useCreditScore({ accountId, userId, mockData });

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              fontSize: isMobile ? '1.5rem' : '2rem',
              mb: 0.5
            }}
          >
            Credit Score Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor your credit health and track score improvements over time
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={refetch}
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Dashboard Grid */}
      <Grid container spacing={3}>
        {/* Credit Score Card */}
        <Grid item xs={12} md={6} lg={4}>
          <CreditScoreCard
            score={data?.currentScore ?? 0}
            previousScore={data?.previousScore}
            lastUpdated={data?.lastUpdated ?? new Date()}
            loading={loading}
            error={error ?? undefined}
          />
        </Grid>

        {/* Risk Factors List */}
        <Grid item xs={12} md={6} lg={8}>
          <RiskFactorsList
            factors={data?.riskFactors ?? []}
            loading={loading}
            error={error ?? undefined}
            maxItems={5}
          />
        </Grid>

        {/* Score History Chart */}
        <Grid item xs={12}>
          <ScoreHistoryChart
            data={data?.history ?? []}
            loading={loading}
            error={error ?? undefined}
            height={450}
          />
        </Grid>
      </Grid>

      {/* Footer Info */}
      <Box
        sx={{
          mt: 4,
          p: 3,
          bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[50] : theme.palette.grey[900],
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          About Credit Scores
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Your credit score is calculated based on your account activity, transaction patterns, payment history,
          and other factors. Scores range from 0-100, with higher scores indicating better creditworthiness.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Poor (0-39)
            </Typography>
            <Typography variant="body2" sx={{ color: '#f44336' }}>
              Significant improvement needed
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Fair (40-69)
            </Typography>
            <Typography variant="body2" sx={{ color: '#ff9800' }}>
              Below average, work on improvements
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Good (70-84)
            </Typography>
            <Typography variant="body2" sx={{ color: '#4caf50' }}>
              Above average, keep it up
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Excellent (85-100)
            </Typography>
            <Typography variant="body2" sx={{ color: '#2196f3' }}>
              Outstanding credit profile
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default CreditScoreDashboard;
