import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { ScoreHistoryChartProps, getScoreRating, SCORE_THRESHOLDS } from '../types/credit-score';

export const ScoreHistoryChart: React.FC<ScoreHistoryChartProps> = ({
  data,
  loading = false,
  error,
  height = 400
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const chartData = useMemo(() => {
    return data.map(item => ({
      score: item.score,
      timestamp: item.timestamp.getTime(),
      date: item.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: item.timestamp.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    }));
  }, [data]);

  const scoreStats = useMemo(() => {
    if (data.length === 0) {
      return { min: 0, max: 100, avg: 0, current: 0 };
    }

    const scores = data.map(d => d.score);
    return {
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      current: scores[scores.length - 1]
    };
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const scoreRating = getScoreRating(data.score);

      return (
        <Box
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            p: 1.5,
            borderRadius: 1,
            boxShadow: theme.shadows[6],
            border: `1px solid ${scoreRating.color}50`,
            minWidth: 120
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}>
            {data.fullDate}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {data.score}
            </Typography>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: scoreRating.color
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: scoreRating.color,
              fontWeight: 600
            }}
          >
            {scoreRating.label}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const scoreRating = getScoreRating(payload.score);

    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={scoreRating.color}
        stroke="white"
        strokeWidth={2}
      />
    );
  };

  if (loading) {
    return (
      <Card sx={{ height }}>
        <Box sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading score history...
            </Typography>
          </Box>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ height }}>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card sx={{ height }}>
        <CardContent>
          <Alert severity="info">
            No score history available. Check back later for your credit score trends.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height,
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: theme.shadows[4]
        }
      }}
      role="region"
      aria-label="Credit Score History Chart"
    >
      <CardContent sx={{ p: 3, height: '100%' }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="h6"
            component="h2"
            sx={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: 600, mb: 1 }}
          >
            Score History
          </Typography>

          {/* Stats Row */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap'
            }}
          >
            {[
              { label: 'Current', value: scoreStats.current, color: getScoreRating(scoreStats.current).color },
              { label: 'Average', value: scoreStats.avg, color: theme.palette.primary.main },
              { label: 'High', value: scoreStats.max, color: theme.palette.success.main },
              { label: 'Low', value: scoreStats.min, color: theme.palette.warning.main }
            ].map((stat, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  bgcolor: `${stat.color}10`,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  minWidth: isMobile ? 60 : 70
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.65rem' }}
                >
                  {stat.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: stat.color,
                    fontSize: isMobile ? '0.875rem' : '1rem'
                  }}
                >
                  {stat.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Chart */}
        <Box sx={{ width: '100%', height: 'calc(100% - 120px)', minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: isMobile ? 10 : 30,
                left: isMobile ? -20 : 0,
                bottom: 5
              }}
            >
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme.palette.grey[300]}
                vertical={false}
              />

              <XAxis
                dataKey="date"
                stroke={theme.palette.text.secondary}
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                axisLine={false}
                interval={isMobile ? Math.floor(chartData.length / 5) : 'preserveStartEnd'}
              />

              <YAxis
                domain={[0, 100]}
                stroke={theme.palette.text.secondary}
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                axisLine={false}
                ticks={[0, 25, 50, 75, 100]}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Background score zones */}
              {SCORE_THRESHOLDS.map((threshold, index) => (
                <Area
                  key={`threshold-${index}`}
                  type="monotone"
                  dataKey={() => threshold.max}
                  fill={`${threshold.color}10`}
                  stroke="none"
                  isAnimationActive={false}
                />
              ))}

              <Area
                type="monotone"
                dataKey="score"
                stroke={theme.palette.primary.main}
                strokeWidth={3}
                fill="url(#scoreGradient)"
                dot={<CustomDot />}
                activeDot={{ r: 6, strokeWidth: 3 }}
                isAnimationActive={true}
                animationDuration={1000}
              />

              <Line
                type="monotone"
                dataKey="score"
                stroke={theme.palette.primary.main}
                strokeWidth={3}
                dot={<CustomDot />}
                activeDot={{ r: 6, strokeWidth: 3 }}
                isAnimationActive={true}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        {/* Legend */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: isMobile ? 1 : 2,
            mt: 2,
            flexWrap: 'wrap'
          }}
        >
          {SCORE_THRESHOLDS.map((threshold, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  bgcolor: threshold.color,
                  borderRadius: 0.5
                }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}
              >
                {threshold.label} ({threshold.min}-{threshold.max})
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ScoreHistoryChart;
