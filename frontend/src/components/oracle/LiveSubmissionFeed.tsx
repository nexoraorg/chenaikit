import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, List, ListItem, ListItemText, Typography, Chip, Paper, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Pending, Error } from '@mui/icons-material';

interface OracleSubmission {
  id: string;
  requestId: string;
  node: {
    address: string;
    reputation: number;
  };
  modelHash: string;
  phase: 'commit' | 'reveal' | 'finalized';
  status: 'pending' | 'committed' | 'revealed' | 'finalized' | 'slashed';
  committedAt: string;
  revealedAt?: string;
  finalizedAt?: string;
}

const LiveSubmissionFeed: React.FC = () => {
  const { t } = useTranslation();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: activity, isLoading, error } = useQuery({
    queryKey: ['oracle-activity'],
    queryFn: async () => {
      const response = await fetch('/api/v2/oracle/activity?limit=20');
      if (!response.ok) throw new Error('Failed to fetch activity');
      const result = await response.json();
      return result.data;
    },
    refetchInterval: autoRefresh ? 5000 : false, // Refresh every 5 seconds if auto-refresh is enabled
  });

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'commit':
        return <Pending color="info" />;
      case 'reveal':
        return <CheckCircle color="warning" />;
      case 'finalized':
        return <CheckCircle color="success" />;
      default:
        return <Error color="error" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'committed':
        return 'info';
      case 'revealed':
        return 'warning';
      case 'finalized':
        return 'success';
      case 'slashed':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-4)}`;
  };

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
          {t('oracleNetwork.errorLoadingActivity')}
        </Typography>
      </Box>
    );
  }

  const submissions = activity?.submissions || [];

  return (
    <Box role="region" aria-label={t('oracleNetwork.liveFeed.title')}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" id="live-feed-title">{t('oracleNetwork.liveFeed.title')}</Typography>
        <Chip
          label={autoRefresh ? t('oracleNetwork.liveFeed.autoRefreshOn') : t('oracleNetwork.liveFeed.autoRefreshOff')}
          onClick={() => setAutoRefresh(!autoRefresh)}
          color={autoRefresh ? 'success' : 'default'}
          clickable
          role="switch"
          aria-checked={autoRefresh}
          aria-label={autoRefresh ? t('oracleNetwork.liveFeed.autoRefreshOn') : t('oracleNetwork.liveFeed.autoRefreshOff')}
        />
      </Box>

      {submissions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }} role="status" aria-live="polite">
          <Typography variant="body1" color="text.secondary">
            {t('oracleNetwork.liveFeed.noActivity')}
          </Typography>
        </Paper>
      ) : (
        <List aria-labelledby="live-feed-title">
          {submissions.map((submission: OracleSubmission) => (
            <ListItem
              key={submission.id}
              divider
              sx={{
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
              role="listitem"
              aria-label={`${t('oracleNetwork.liveFeed.request')} ${submission.requestId}, ${t('oracleNetwork.liveFeed.node')} ${formatAddress(submission.node.address)}, ${t('oracleNetwork.liveFeed.phase')} ${submission.phase}`}
            >
              <Box sx={{ mr: 2 }} aria-hidden="true">
                {getPhaseIcon(submission.phase)}
              </Box>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {formatAddress(submission.node.address)}
                    </Typography>
                    <Chip
                      label={submission.phase}
                      size="small"
                      color={getStatusColor(submission.status) as any}
                      aria-label={`${t('oracleNetwork.liveFeed.phase')}: ${submission.phase}`}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('oracleNetwork.liveFeed.request')}: {submission.requestId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                      {t('oracleNetwork.liveFeed.reputation')}: {submission.node.reputation}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default LiveSubmissionFeed;
