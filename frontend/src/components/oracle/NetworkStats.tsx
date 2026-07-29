import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Card, CardContent, Typography, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Security, Warning, Assessment } from '@mui/icons-material';

interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalStake: bigint;
  averageReputation: number;
  totalSubmissions: number;
  totalDisputes: number;
  totalSlashes: number;
}

const NetworkStats: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const { data: stats, isLoading, error } = useQuery<NetworkStats>({
    queryKey: ['oracle-network-stats'],
    queryFn: async () => {
      const response = await fetch('/api/v2/oracle/stats');
      if (!response.ok) throw new Error('Failed to fetch network stats');
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('oracleNetwork.loadingStats')}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="error">
          {t('oracleNetwork.errorLoadingStats')}
        </Typography>
      </Box>
    );
  }

  const formatStake = (stake: bigint) => {
    return (Number(stake) / 10_000_000).toFixed(2); // Convert stroops to XLM
  };

  const statCards = [
    {
      title: t('oracleNetwork.stats.totalNodes'),
      value: stats?.totalNodes || 0,
      icon: <Security />,
      color: theme.palette.primary.main,
    },
    {
      title: t('oracleNetwork.stats.activeNodes'),
      value: stats?.activeNodes || 0,
      icon: <TrendingUp />,
      color: theme.palette.success.main,
    },
    {
      title: t('oracleNetwork.stats.totalStake'),
      value: stats?.totalStake ? `${formatStake(stats.totalStake)} XLM` : '0 XLM',
      icon: <Assessment />,
      color: theme.palette.info.main,
    },
    {
      title: t('oracleNetwork.stats.averageReputation'),
      value: stats?.averageReputation?.toFixed(1) || '0',
      icon: <TrendingUp />,
      color: theme.palette.warning.main,
    },
    {
      title: t('oracleNetwork.stats.totalSubmissions'),
      value: stats?.totalSubmissions || 0,
      icon: <Assessment />,
      color: theme.palette.secondary.main,
    },
    {
      title: t('oracleNetwork.stats.totalDisputes'),
      value: stats?.totalDisputes || 0,
      icon: <Warning />,
      color: theme.palette.error.main,
    },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 3 }} role="region" aria-label={t('oracleNetwork.networkStats.title')}>
      {statCards.map((card, index) => (
        <Grid item xs={12} sm={6} md={2} key={index}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
              },
            }}
            role="article"
            aria-label={`${card.title}: ${card.value}`}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: `${card.color}20`,
                    color: card.color,
                    mr: 2,
                  }}
                  aria-hidden="true"
                >
                  {card.icon}
                </Box>
                <Typography variant="body2" color="text.secondary" id={`stat-title-${index}`}>
                  {card.title}
                </Typography>
              </Box>
              <Typography 
                variant="h4" 
                component="div" 
                fontWeight="bold"
                aria-labelledby={`stat-title-${index}`}
              >
                {card.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default NetworkStats;
