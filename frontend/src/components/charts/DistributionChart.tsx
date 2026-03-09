import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';

interface DistributionChartProps {
  data: Record<string, number>;
  title: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const DistributionChart: React.FC<DistributionChartProps> = ({ data, title }) => {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <Paper sx={{ p: 3, borderRadius: 2, height: 400 }}>
      <Typography variant="h6" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
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
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
              }}
            />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
