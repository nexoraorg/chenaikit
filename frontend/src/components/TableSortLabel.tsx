import React from 'react';
import { Box, TableSortLabel as MuiTableSortLabel, Typography } from '@mui/material';

export type SortDirection = 'asc' | 'desc';

export interface TableSortLabelProps {
  /** Column header label */
  label: React.ReactNode;
  /** Whether this column is currently sorted */
  active?: boolean;
  /** Current sort direction when active */
  direction?: SortDirection;
  /** 1-based priority for multi-column sorts */
  sortIndex?: number;
  /** Show multi-sort priority badge when > 1 sorts are active */
  showSortIndex?: boolean;
  /** Called when the user activates the sort control */
  onSort?: (event: React.MouseEvent<HTMLSpanElement>) => void;
  /** Disable interaction */
  disabled?: boolean;
}

/**
 * Accessible column sort control with optional multi-sort priority indicator.
 * Shift-click is handled by the parent DataTable via the click event.
 */
export const TableSortLabel: React.FC<TableSortLabelProps> = ({
  label,
  active = false,
  direction = 'asc',
  sortIndex,
  showSortIndex = false,
  onSort,
  disabled = false,
}) => {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, maxWidth: '100%' }}>
      <MuiTableSortLabel
        active={active}
        direction={active ? direction : 'asc'}
        onClick={onSort}
        disabled={disabled}
        hideSortIcon={false}
        sx={{
          '& .MuiTableSortLabel-icon': {
            opacity: active ? 1 : 0.3,
          },
        }}
      >
        {label}
      </MuiTableSortLabel>
      {showSortIndex && active && typeof sortIndex === 'number' && sortIndex > 0 && (
        <Typography
          component="span"
          variant="caption"
          aria-label={`Sort priority ${sortIndex}`}
          sx={{
            minWidth: 16,
            height: 16,
            lineHeight: '16px',
            textAlign: 'center',
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {sortIndex}
        </Typography>
      )}
    </Box>
  );
};

export default TableSortLabel;
