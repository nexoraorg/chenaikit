import React, { useEffect, useState } from 'react';
import {
  Box,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import { DateRangePicker, DateRangeValue } from './DateRangePicker';

export type TableFilterType = 'text' | 'select' | 'dateRange';

export interface TableFilterOption {
  label: string;
  value: string;
}

export type TableFilterValue = string | DateRangeValue | null;

export interface TableFilterProps {
  columnId: string;
  label: string;
  type?: TableFilterType;
  value: TableFilterValue;
  onChange: (columnId: string, value: TableFilterValue) => void;
  options?: TableFilterOption[];
  /** Debounce delay for text filters (ms) */
  debounceMs?: number;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

const emptyDateRange = (): DateRangeValue => ({ start: null, end: null });

const isDateRangeValue = (value: TableFilterValue): value is DateRangeValue =>
  !!value && typeof value === 'object' && 'start' in value && 'end' in value;

/**
 * Inline column filter supporting text search, dropdown select, and date ranges.
 * Text input is debounced to avoid excessive filtering on every keystroke.
 */
export const TableFilter: React.FC<TableFilterProps> = ({
  columnId,
  label,
  type = 'text',
  value,
  onChange,
  options = [],
  debounceMs = 300,
  disabled = false,
  size = 'small',
}) => {
  const [textValue, setTextValue] = useState(typeof value === 'string' ? value : '');

  useEffect(() => {
    if (type === 'text') {
      setTextValue(typeof value === 'string' ? value : '');
    }
  }, [type, value]);

  useEffect(() => {
    if (type !== 'text') return undefined;

    const handle = window.setTimeout(() => {
      const next = textValue;
      const current = typeof value === 'string' ? value : '';
      if (next !== current) {
        onChange(columnId, next);
      }
    }, debounceMs);

    return () => window.clearTimeout(handle);
  }, [textValue, columnId, debounceMs, onChange, type, value]);

  const clearFilter = () => {
    if (type === 'dateRange') {
      onChange(columnId, emptyDateRange());
      return;
    }
    if (type === 'text') {
      setTextValue('');
    }
    onChange(columnId, '');
  };

  if (type === 'select') {
    const selectValue = typeof value === 'string' ? value : '';
    return (
      <FormControl size={size} fullWidth disabled={disabled} sx={{ minWidth: 120 }}>
        <InputLabel id={`filter-${columnId}-label`}>{label}</InputLabel>
        <Select
          labelId={`filter-${columnId}-label`}
          id={`filter-${columnId}`}
          label={label}
          value={selectValue}
          onChange={(event) => onChange(columnId, event.target.value)}
          endAdornment={
            selectValue ? (
              <InputAdornment position="end" sx={{ mr: 2 }}>
                <IconButton
                  size="small"
                  aria-label={`Clear ${label} filter`}
                  onClick={(event) => {
                    event.stopPropagation();
                    clearFilter();
                  }}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined
          }
        >
          <MenuItem value="">
            <em>All</em>
          </MenuItem>
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (type === 'dateRange') {
    const range = isDateRangeValue(value) ? value : emptyDateRange();
    const hasRange = !!(range.start || range.end);

    return (
      <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 220 }}>
        <Box sx={{ flex: 1 }}>
          <DateRangePicker
            value={range}
            onChange={(next) => onChange(columnId, next)}
            startLabel={`${label} from`}
            endLabel={`${label} to`}
            disabled={disabled}
            fullWidth
          />
        </Box>
        {hasRange && (
          <Tooltip title={`Clear ${label} filter`}>
            <IconButton
              size="small"
              aria-label={`Clear ${label} filter`}
              onClick={clearFilter}
              disabled={disabled}
              sx={{ mt: 1 }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  }

  return (
    <TextField
      size={size}
      fullWidth
      label={label}
      value={textValue}
      onChange={(event) => setTextValue(event.target.value)}
      disabled={disabled}
      inputProps={{ 'aria-label': `${label} filter` }}
      InputProps={{
        endAdornment: textValue ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              aria-label={`Clear ${label} filter`}
              onClick={clearFilter}
              edge="end"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );
};

export default TableFilter;
