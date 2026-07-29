import React from 'react';
import { Box, Skeleton, Paper } from '@mui/material';

interface SkeletonChartProps {
  height?: number | string;
}

export const SkeletonChart: React.FC<SkeletonChartProps> = ({ height = 300 }) => {
  return (
    <Paper sx={{ p: 2, height, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton variant="text" width="40%" height={32} />
        <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} />
      </Box>
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'flex-end', gap: 2, pt: 2 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton 
            key={i} 
            variant="rectangular" 
            height={`${Math.max(20, Math.random() * 100)}%`} 
            width="100%" 
            sx={{ borderRadius: '4px 4px 0 0' }}
          />
        ))}
      </Box>
    </Paper>
  );
};
