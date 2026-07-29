import React from 'react';
import {
  Box,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material';
import {
  FirstPage as FirstPageIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  LastPage as LastPageIcon,
} from '@mui/icons-material';

export interface TablePaginationProps {
  /** Total number of filtered rows */
  count: number;
  /** Zero-based page index */
  page: number;
  /** Rows per page */
  rowsPerPage: number;
  /** Available page size options */
  rowsPerPageOptions?: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  disabled?: boolean;
  labelRowsPerPage?: string;
}

/**
 * Compact pagination controls with page size selector and range display.
 */
export const TablePagination: React.FC<TablePaginationProps> = ({
  count,
  page,
  rowsPerPage,
  rowsPerPageOptions = [10, 25, 50, 100],
  onPageChange,
  onRowsPerPageChange,
  disabled = false,
  labelRowsPerPage = 'Rows per page',
}) => {
  const totalPages = Math.max(1, Math.ceil(count / rowsPerPage) || 1);
  const safePage = Math.min(page, totalPages - 1);
  const from = count === 0 ? 0 : safePage * rowsPerPage + 1;
  const to = Math.min(count, (safePage + 1) * rowsPerPage);

  const handleRowsPerPageChange = (event: SelectChangeEvent<number>) => {
    onRowsPerPageChange(Number(event.target.value));
  };

  return (
    <Box
      role="navigation"
      aria-label="Table pagination"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 1,
        px: 1,
        py: 1.5,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" component="label" htmlFor="rows-per-page">
          {labelRowsPerPage}
        </Typography>
        <FormControl size="small" disabled={disabled}>
          <Select
            id="rows-per-page"
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
            inputProps={{ 'aria-label': labelRowsPerPage }}
            sx={{ minWidth: 72 }}
          >
            {rowsPerPageOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }} aria-live="polite">
        {count === 0 ? '0–0 of 0' : `${from}–${to} of ${count}`}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton
          onClick={() => onPageChange(0)}
          disabled={disabled || safePage === 0}
          aria-label="First page"
          size="small"
        >
          <FirstPageIcon />
        </IconButton>
        <IconButton
          onClick={() => onPageChange(safePage - 1)}
          disabled={disabled || safePage === 0}
          aria-label="Previous page"
          size="small"
        >
          <KeyboardArrowLeft />
        </IconButton>
        <IconButton
          onClick={() => onPageChange(safePage + 1)}
          disabled={disabled || safePage >= totalPages - 1}
          aria-label="Next page"
          size="small"
        >
          <KeyboardArrowRight />
        </IconButton>
        <IconButton
          onClick={() => onPageChange(totalPages - 1)}
          disabled={disabled || safePage >= totalPages - 1}
          aria-label="Last page"
          size="small"
        >
          <LastPageIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default TablePagination;
