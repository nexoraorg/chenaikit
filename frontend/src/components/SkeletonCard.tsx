import React from 'react';
import { Card, CardContent, CardActions, Skeleton, Box } from '@mui/material';

interface SkeletonCardProps {
  hasActions?: boolean;
  lines?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ hasActions = false, lines = 3 }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} variant="text" width={index === lines - 1 ? "80%" : "100%"} />
        ))}
      </CardContent>
      {hasActions && (
        <CardActions>
          <Box display="flex" gap={1} width="100%">
            <Skeleton variant="rectangular" width={80} height={36} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width={80} height={36} sx={{ borderRadius: 1 }} />
          </Box>
        </CardActions>
      )}
    </Card>
  );
};
