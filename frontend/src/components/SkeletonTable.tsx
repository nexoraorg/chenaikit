import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Skeleton
} from '@mui/material';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <TableContainer
      component={Paper}
      className="responsive-table-scroll"
      sx={{
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Table sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableCell key={`head-${index}`}>
                <Skeleton variant="text" />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={`row-${rowIndex}`}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={`cell-${rowIndex}-${colIndex}`}>
                  <Skeleton variant="text" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
