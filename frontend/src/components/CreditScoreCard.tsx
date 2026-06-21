import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  AccessTime
} from '@mui/icons-material';
import { CreditScoreCardProps, getScoreRating } from '../types/credit-score';

export const CreditScoreCard: React.FC<CreditScoreCardProps> = ({
  score,
  previousScore,
  lastUpdated,
  loading = false,
  error
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (loading) {
    return (
      <Card
        sx={{
          minHeight: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading credit score...
          </Typography>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ minHeight: 280 }}>
        <CardContent>
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const scoreRating = getScoreRating(score);
  const scoreDiff = previousScore !== undefined ? score - previousScore : 0;
  const hasTrend = previousScore !== undefined;

  const getTrendIcon = () => {
    if (!hasTrend || scoreDiff === 0) return <TrendingFlat />;
    return scoreDiff > 0 ? <TrendingUp /> : <TrendingDown />;
  };

  const getTrendColor = () => {
    if (!hasTrend || scoreDiff === 0) return theme.palette.grey[600];
    return scoreDiff > 0 ? theme.palette.success.main : theme.palette.error.main;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card
      sx={{
        minHeight: 280,
        background: `linear-gradient(135deg, ${scoreRating.color}15 0%, ${scoreRating.color}05 100%)`,
        border: `2px solid ${scoreRating.color}30`,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8]
        }
      }}
      role="region"
      aria-label="Credit Score Card"
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            component="h2"
            color="text.secondary"
            sx={{ fontSize: isMobile ? '0.875rem' : '1rem', fontWeight: 500 }}
          >
            Your Credit Score
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <AccessTime sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
            <Typography variant="caption" color="text.secondary">
              Updated {formatDate(lastUpdated)}
            </Typography>
          </Box>
        </Box>

        {/* Score Display */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
            gap: 2
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Circular Progress Background */}
            <CircularProgress
              variant="determinate"
              value={100}
              size={isMobile ? 140 : 160}
              thickness={6}
              sx={{
                color: theme.palette.grey[200],
                position: 'absolute'
              }}
            />
            {/* Circular Progress Score */}
            <CircularProgress
              variant="determinate"
              value={score}
              size={isMobile ? 140 : 160}
              thickness={6}
              sx={{
                color: scoreRating.color,
                position: 'absolute',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round'
                }
              }}
            />
            {/* Score Number */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="h2"
                component="div"
                sx={{
                  fontWeight: 700,
                  fontSize: isMobile ? '2.5rem' : '3rem',
                  color: scoreRating.color,
                  lineHeight: 1
                }}
              >
                {score}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.75rem' }}
              >
                out of 100
              </Typography>
            </Box>
          </Box>

          {/* Rating and Trend */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            alignItems: isMobile ? 'center' : 'flex-start'
          }}>
            <Chip
              label={scoreRating.label}
              sx={{
                bgcolor: scoreRating.color,
                color: 'white',
                fontWeight: 600,
                fontSize: isMobile ? '0.875rem' : '1rem',
                px: 1,
                py: 2.5
              }}
            />

            {hasTrend && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: `${getTrendColor()}15`,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1
                }}
              >
                {React.cloneElement(getTrendIcon(), {
                  sx: { fontSize: 20, color: getTrendColor() }
                })}
                <Typography
                  variant="body2"
                  sx={{
                    color: getTrendColor(),
                    fontWeight: 600
                  }}
                >
                  {Math.abs(scoreDiff)} point{Math.abs(scoreDiff) !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Score Range Indicator */}
        <Box sx={{ mt: 3 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 1, display: 'block' }}
          >
            Score Range
          </Typography>
          <Box
            sx={{
              height: 8,
              borderRadius: 1,
              background: `linear-gradient(to right, 
                #f44336 0%, #f44336 39%, 
                #ff9800 39%, #ff9800 69%, 
                #4caf50 69%, #4caf50 84%, 
                #2196f3 84%, #2196f3 100%)`,
              position: 'relative',
              mb: 1
            }}
          >
            {/* Score Marker */}
            <Box
              sx={{
                position: 'absolute',
                left: `${score}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: 'white',
                border: `3px solid ${scoreRating.color}`,
                boxShadow: theme.shadows[3],
                transition: 'left 0.5s ease-in-out'
              }}
              aria-label={`Score indicator at ${score}`}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">0</Typography>
            <Typography variant="caption" color="text.secondary">100</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CreditScoreCard;
