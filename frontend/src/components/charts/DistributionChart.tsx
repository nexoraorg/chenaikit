import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { Paper, Typography, Box, useTheme } from '@mui/material';
import ChartAccessibleSummary from '../a11y/ChartAccessibleSummary';

interface DistributionChartProps {
  data: Record<string, number>;
  title: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const DistributionChart: React.FC<DistributionChartProps> = ({ data, title }) => {
  const theme = useTheme();
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

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
        rows={chartData.map((entry) => ({
          label: entry.name,
          value: entry.value,
        }))}
      />
      <Box sx={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span style={{ color: theme.palette.text.secondary }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
