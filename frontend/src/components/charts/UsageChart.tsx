import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import ChartAccessibleSummary from '../a11y/ChartAccessibleSummary';

interface UsageChartProps {
  data: Array<{ date: string; value: number }>;
  forecast?: Array<{ date: string; value: number }>;
  title: string;
}

export const UsageChart: React.FC<UsageChartProps> = ({ data, forecast, title }) => {
  const theme = useTheme();
  const combinedData = [...data, ...(forecast || []).map(f => ({ ...f, isForecast: true }))];

  return (
    <Paper
      component="section"
      role="region"
      aria-label={title}
      sx={{ p: 3, borderRadius: 2, height: 400 }}
    >
      <Typography variant="h6" component="h3" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <ChartAccessibleSummary
        title={title}
        rows={combinedData.map((point) => ({
          label: String(point.date),
          value: point.value,
        }))}
      />
      <Box sx={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={combinedData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={theme.palette.primary.main} 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              activeDot={{ r: 8 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
