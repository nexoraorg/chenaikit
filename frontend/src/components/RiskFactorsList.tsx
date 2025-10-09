import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Collapse,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  WarningAmber,
  Error,
  CheckCircle,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { RiskFactorsListProps } from '../types/credit-score';

export const RiskFactorsList: React.FC<RiskFactorsListProps> = ({
  factors,
  loading = false,
  error,
  maxItems
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);

  const displayedFactors = maxItems && !expanded
    ? factors.slice(0, maxItems)
    : factors;
  const hasMore = maxItems && factors.length > maxItems;

  const getImpactIcon = (impact: 'positive' | 'negative', severity: 'low' | 'medium' | 'high') => {
    if (impact === 'positive') {
      return <TrendingUp sx={{ color: theme.palette.success.main }} />;
    }

    switch (severity) {
      case 'high':
        return <Error sx={{ color: theme.palette.error.main }} />;
      case 'medium':
        return <WarningAmber sx={{ color: theme.palette.warning.main }} />;
      case 'low':
        return <TrendingDown sx={{ color: theme.palette.info.main }} />;
      default:
        return <TrendingDown sx={{ color: theme.palette.info.main }} />;
    }
  };

  const getSeverityColor = (impact: 'positive' | 'negative', severity: 'low' | 'medium' | 'high') => {
    if (impact === 'positive') {
      return theme.palette.success.main;
    }

    switch (severity) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.info.main;
      default:
        return theme.palette.grey[600];
    }
  };

  const getSeverityLabel = (severity: 'low' | 'medium' | 'high') => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  const getImpactLabel = (impact: 'positive' | 'negative') => {
    return impact === 'positive' ? 'Positive' : 'Negative';
  };

  if (loading) {
    return (
      <Card sx={{ minHeight: 300 }}>
        <Box sx={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading risk factors...
            </Typography>
          </Box>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ minHeight: 300 }}>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (factors.length === 0) {
    return (
      <Card sx={{ minHeight: 300 }}>
        <CardContent>
          <Alert severity="info" icon={<CheckCircle />}>
            No risk factors identified. Your credit profile looks great!
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const positiveFactors = factors.filter(f => f.impact === 'positive');
  const negativeFactors = factors.filter(f => f.impact === 'negative');

  return (
    <Card
      sx={{
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: theme.shadows[4]
        }
      }}
      role="region"
      aria-label="Risk Factors List"
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="h6"
            component="h2"
            sx={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: 600, mb: 1 }}
          >
            Risk Factors Analysis
          </Typography>

          {/* Summary Stats */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Chip
              icon={<TrendingUp />}
              label={`${positiveFactors.length} Positive`}
              size="small"
              sx={{
                bgcolor: `${theme.palette.success.main}15`,
                color: theme.palette.success.dark,
                fontWeight: 600,
                '& .MuiChip-icon': {
                  color: theme.palette.success.main
                }
              }}
            />
            <Chip
              icon={<TrendingDown />}
              label={`${negativeFactors.length} Negative`}
              size="small"
              sx={{
                bgcolor: `${theme.palette.error.main}15`,
                color: theme.palette.error.dark,
                fontWeight: 600,
                '& .MuiChip-icon': {
                  color: theme.palette.error.main
                }
              }}
            />
          </Box>
        </Box>

        {/* Factors List */}
        <List sx={{ p: 0 }}>
          {displayedFactors.map((factor, index) => {
            const impactColor = getSeverityColor(factor.impact, factor.severity);
            const isLast = index === displayedFactors.length - 1;

            return (
              <ListItem
                key={factor.id}
                sx={{
                  px: 0,
                  py: 1.5,
                  borderBottom: !isLast ? `1px solid ${theme.palette.divider}` : 'none',
                  alignItems: 'flex-start',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: `${impactColor}05`,
                    borderRadius: 1
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                  {getImpactIcon(factor.impact, factor.severity)}
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: theme.palette.text.primary,
                          flex: 1
                        }}
                      >
                        {factor.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={getImpactLabel(factor.impact)}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: `${impactColor}20`,
                            color: impactColor,
                            '& .MuiChip-label': {
                              px: 1
                            }
                          }}
                        />
                        <Chip
                          label={getSeverityLabel(factor.severity)}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: theme.palette.grey[200],
                            color: theme.palette.text.secondary,
                            '& .MuiChip-label': {
                              px: 1
                            }
                          }}
                        />
                      </Box>
                    </Box>
                  }
                  secondary={
                    <Box
                      sx={{
                        mt: 0.5,
                        height: 4,
                        width: '100%',
                        bgcolor: theme.palette.grey[200],
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: factor.severity === 'high' ? '100%' : factor.severity === 'medium' ? '66%' : '33%',
                          bgcolor: impactColor,
                          transition: 'width 0.5s ease-in-out'
                        }}
                      />
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>

        {/* Show More/Less Button */}
        {hasMore && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              onClick={() => setExpanded(!expanded)}
              endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
              size="small"
              sx={{ textTransform: 'none' }}
            >
              {expanded
                ? 'Show Less'
                : `Show ${factors.length - maxItems!} More Factor${factors.length - maxItems! > 1 ? 's' : ''}`
              }
            </Button>
          </Box>
        )}

        {/* Footer Info */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${theme.palette.divider}`
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            Risk factors are identified using AI-powered analysis of your account activity,
            transaction patterns, and payment history.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RiskFactorsList;
