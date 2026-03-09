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
import { Box, Typography, Paper } from '@mui/material';

interface UsageChartProps {
  data: Array<{ date: string; value: number }>;
  forecast?: Array<{ date: string; value: number }>;
  title: string;
}

export const UsageChart: React.FC<UsageChartProps> = ({ data, forecast, title }) => {
  const combinedData = [...data, ...(forecast || []).map(f => ({ ...f, isForecast: true }))];

  return (
    <Paper sx={{ p: 3, borderRadius: 2, height: 400 }}>
      <Typography variant="h6" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Box sx={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={combinedData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#3B82F6" 
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
