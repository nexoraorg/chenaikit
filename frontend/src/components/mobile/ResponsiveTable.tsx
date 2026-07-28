import React from 'react';
import { Box, TableContainer, Paper } from '@mui/material';

export interface ResponsiveTableProps {
  children: React.ReactNode;
  /** Optional min width of the table so columns stay readable while scrolling. */
  minWidth?: number | string;
  component?: React.ElementType;
  className?: string;
}

/**
 * Wraps table content so it scrolls horizontally on narrow viewports
 * without causing page-level horizontal overflow.
 */
export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  minWidth = 560,
  component = Paper,
  className,
}) => {
  return (
    <TableContainer
      component={component}
      className={['responsive-table-scroll', className].filter(Boolean).join(' ')}
      sx={{
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Box sx={{ minWidth, display: 'inline-block', width: '100%' }}>{children}</Box>
    </TableContainer>
  );
};

export default ResponsiveTable;
