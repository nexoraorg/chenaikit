import React from 'react';
import { Box, IconButton, SvgIcon } from '@mui/material';
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';

export interface SortDirection {
  id: string;
  desc: boolean;
}

export interface TableSortLabelProps {
  columnId: string;
  label: string;
  sortDirections: SortDirection[];
  multiSortEnabled: boolean;
  onToggleSort: (columnId: string, shiftKey: boolean) => void;
  style?: React.CSSProperties;
}

const sortPriorityColors = ['#1976d2', '#4caf50', '#ff9800'];

const TableSortLabel: React.FC<TableSortLabelProps> = ({
  columnId,
  label,
  sortDirections,
  multiSortEnabled,
  onToggleSort,
  style,
}) => {
  const sortIndex = sortDirections.findIndex(s => s.id === columnId);
  const isSorted = sortIndex !== -1;
  const isDesc = isSorted && sortDirections[sortIndex].desc;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        userSelect: 'none',
        ...style,
      }}
      onClick={(e) => onToggleSort(columnId, e.shiftKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleSort(columnId, e.shiftKey);
        }
      }}
      aria-label={`Sort by ${label}${isSorted ? ` (${isDesc ? 'descending' : 'ascending'})` : ''}`}
    >
      {label}
      <SvgIcon
        sx={{
          fontSize: 16,
          opacity: isSorted ? 1 : 0.3,
          transition: 'opacity 0.2s',
          color: isSorted ? sortPriorityColors[Math.min(sortIndex, sortPriorityColors.length - 1)] : 'inherit',
        }}
      >
        {isSorted ? (
          isDesc ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />
        ) : (
          <UnfoldMoreIcon />
        )}
      </SvgIcon>
      {multiSortEnabled && isSorted && sortDirections.length > 1 && (
        <Box
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 'bold',
            color: sortPriorityColors[Math.min(sortIndex, sortPriorityColors.length - 1)],
            lineHeight: 1,
          }}
        >
          {sortIndex + 1}
        </Box>
      )}
    </Box>
  );
};

export default TableSortLabel;
