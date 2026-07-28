import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Inbox as InboxIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import { storageGet, storageSet } from '../utils/storage';
import { TableSortLabel, SortDirection } from './TableSortLabel';
import {
  TableFilter,
  TableFilterOption,
  TableFilterType,
  TableFilterValue,
} from './TableFilter';
import { TablePagination } from './TablePagination';
import type { DateRangeValue } from './DateRangePicker';

// ─── Lightweight virtual list ────────────────────────────────────────────────

interface VirtualListProps {
  height: number;
  itemCount: number;
  itemSize: number;
  width?: number | string;
  overscanCount?: number;
  children: (props: { index: number; style: React.CSSProperties }) => React.ReactNode;
}

const VirtualList: React.FC<VirtualListProps> = ({
  height,
  itemCount,
  itemSize,
  width = '100%',
  overscanCount = 8,
  children,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscanCount);
  const visibleCount = Math.ceil(height / itemSize) + overscanCount * 2;
  const endIndex = Math.min(itemCount - 1, startIndex + visibleCount);
  const offsetY = startIndex * itemSize;

  const items: React.ReactNode[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    items.push(
      children({
        index,
        style: {
          position: 'absolute',
          top: offsetY + (index - startIndex) * itemSize,
          left: 0,
          width: '100%',
          height: itemSize,
        },
      }),
    );
  }

  return (
    <Box
      sx={{ height, width, overflow: 'auto', position: 'relative' }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <Box sx={{ height: itemCount * itemSize, position: 'relative' }}>{items}</Box>
    </Box>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SortDescriptor {
  id: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  accessorKey?: keyof T & string;
  accessorFn?: (row: T) => unknown;
  cell?: (info: { row: T; value: unknown; rowId: string }) => React.ReactNode;
  sortable?: boolean;
  sortFn?: (a: T, b: T) => number;
  filterable?: boolean;
  filterType?: TableFilterType;
  filterOptions?: TableFilterOption[];
  filterFn?: (row: T, filterValue: TableFilterValue) => boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  hideable?: boolean;
  defaultHidden?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId?: (row: T, index: number) => string;

  enableSorting?: boolean;
  enableMultiSort?: boolean;
  initialSorting?: SortDescriptor[];

  enableFiltering?: boolean;
  initialFilters?: Record<string, TableFilterValue>;

  enableRowSelection?: boolean;
  onSelectionChange?: (selectedIds: string[], selectedRows: T[]) => void;

  enableExpanding?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;

  enableColumnResizing?: boolean;
  enableColumnVisibility?: boolean;

  enablePagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];

  enableVirtualization?: boolean;
  virtualizationThreshold?: number;
  rowHeight?: number;
  maxHeight?: number | string;

  persistKey?: string;
  stickyHeader?: boolean;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;

  dense?: boolean;
  toolbarContent?: React.ReactNode;
  'aria-label'?: string;
}

interface PersistedState {
  sorting: SortDescriptor[];
  filters: Record<string, TableFilterValue>;
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;
  pageSize?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const defaultGetRowId = <T,>(_row: T, index: number) => String(index);

const getCellValue = <T,>(row: T, column: DataTableColumn<T>): unknown => {
  if (column.accessorFn) return column.accessorFn(row);
  if (column.accessorKey) return row[column.accessorKey];
  return undefined;
};

const compareValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

const isDateRange = (value: TableFilterValue): value is DateRangeValue =>
  !!value && typeof value === 'object' && 'start' in value && 'end' in value;

const isFilterActive = (value: TableFilterValue | undefined): boolean => {
  if (value == null || value === '') return false;
  if (isDateRange(value)) return !!(value.start || value.end);
  return true;
};

const matchesFilter = <T,>(
  row: T,
  column: DataTableColumn<T>,
  filterValue: TableFilterValue,
): boolean => {
  if (!isFilterActive(filterValue)) return true;
  if (column.filterFn) return column.filterFn(row, filterValue);

  const cellValue = getCellValue(row, column);
  const filterType = column.filterType ?? 'text';

  if (filterType === 'select') {
    return String(cellValue ?? '') === String(filterValue);
  }

  if (filterType === 'dateRange' && isDateRange(filterValue)) {
    const date =
      cellValue instanceof Date
        ? cellValue
        : cellValue
          ? new Date(String(cellValue))
          : null;
    if (!date || Number.isNaN(date.getTime())) return false;
    const time = date.getTime();
    if (filterValue.start && time < filterValue.start.getTime()) return false;
    if (filterValue.end) {
      const end = new Date(filterValue.end);
      end.setHours(23, 59, 59, 999);
      if (time > end.getTime()) return false;
    }
    return true;
  }

  return String(cellValue ?? '')
    .toLowerCase()
    .includes(String(filterValue).toLowerCase());
};

const reviveFilters = (
  filters: Record<string, TableFilterValue>,
): Record<string, TableFilterValue> => {
  const next: Record<string, TableFilterValue> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (isDateRange(value)) {
      next[key] = {
        start: value.start ? new Date(value.start) : null,
        end: value.end ? new Date(value.end) : null,
      };
    } else {
      next[key] = value;
    }
  });
  return next;
};

// ─── Component ───────────────────────────────────────────────────────────────

function DataTableInner<T>(props: DataTableProps<T>) {
  const {
    data,
    columns,
    getRowId = defaultGetRowId,
    enableSorting = true,
    enableMultiSort = true,
    initialSorting = [],
    enableFiltering = true,
    initialFilters = {},
    enableRowSelection = false,
    onSelectionChange,
    enableExpanding = false,
    renderExpandedRow,
    enableColumnResizing = true,
    enableColumnVisibility = true,
    enablePagination = true,
    pageSize: pageSizeProp = 25,
    pageSizeOptions = [10, 25, 50, 100],
    enableVirtualization = true,
    virtualizationThreshold = 200,
    rowHeight = 52,
    maxHeight = 560,
    persistKey,
    stickyHeader = true,
    loading = false,
    error = null,
    onRetry,
    emptyMessage = 'No data available',
    dense = false,
    toolbarContent,
    'aria-label': ariaLabel = 'Data table',
  } = props;

  const persisted = useMemo(() => {
    if (!persistKey) return null;
    return storageGet<PersistedState>(`datatable_${persistKey}`);
  }, [persistKey]);

  const [sorting, setSorting] = useState<SortDescriptor[]>(
    () => persisted?.sorting ?? initialSorting,
  );
  const [filters, setFilters] = useState<Record<string, TableFilterValue>>(() =>
    reviveFilters(persisted?.filters ?? initialFilters),
  );
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    if (persisted?.columnVisibility) return persisted.columnVisibility;
    const initial: Record<string, boolean> = {};
    columns.forEach((col) => {
      initial[col.id] = !col.defaultHidden;
    });
    return initial;
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => persisted?.columnWidths ?? {},
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(
    () => persisted?.pageSize ?? pageSizeProp,
  );
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

  const resizingRef = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    if (!persistKey) return;
    storageSet(`datatable_${persistKey}`, {
      sorting,
      filters,
      columnVisibility,
      columnWidths,
      pageSize: rowsPerPage,
    } satisfies PersistedState);
  }, [persistKey, sorting, filters, columnVisibility, columnWidths, rowsPerPage]);

  const visibleColumns = useMemo(
    () => columns.filter((col) => columnVisibility[col.id] !== false),
    [columns, columnVisibility],
  );

  const getWidth = useCallback(
    (column: DataTableColumn<T>) =>
      columnWidths[column.id] ?? column.width ?? column.minWidth ?? 140,
    [columnWidths],
  );

  const filteredData = useMemo(() => {
    if (!enableFiltering) return data;
    const active = Object.entries(filters).filter(([, value]) => isFilterActive(value));
    if (active.length === 0) return data;

    return data.filter((row) =>
      active.every(([columnId, value]) => {
        const column = columns.find((col) => col.id === columnId);
        if (!column) return true;
        return matchesFilter(row, column, value);
      }),
    );
  }, [data, filters, columns, enableFiltering]);

  const sortedData = useMemo(() => {
    if (!enableSorting || sorting.length === 0) return filteredData;

    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      for (const descriptor of sorting) {
        const column = columns.find((col) => col.id === descriptor.id);
        if (!column) continue;

        let result: number;
        if (column.sortFn) {
          result = column.sortFn(a, b);
        } else {
          result = compareValues(getCellValue(a, column), getCellValue(b, column));
        }
        if (result !== 0) {
          return descriptor.direction === 'desc' ? -result : result;
        }
      }
      return 0;
    });
    return sorted;
  }, [filteredData, sorting, columns, enableSorting]);

  const pagedData = useMemo(() => {
    if (!enablePagination) return sortedData;
    const start = page * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, enablePagination, page, rowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedData.length / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [sortedData.length, rowsPerPage, page]);

  const useVirtual =
    enableVirtualization &&
    !enableExpanding &&
    pagedData.length >= virtualizationThreshold;

  useEffect(() => {
    if (!onSelectionChange) return;
    const rows = data.filter((row, index) => selectedIds.has(getRowId(row, index)));
    onSelectionChange(Array.from(selectedIds), rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, data, getRowId]);

  const handleSort = useCallback(
    (columnId: string, event: React.MouseEvent) => {
      if (!enableSorting) return;
      const multi = enableMultiSort && event.shiftKey;

      setSorting((prev) => {
        const existingIndex = prev.findIndex((s) => s.id === columnId);
        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          if (existing.direction === 'asc') {
            const next = [...prev];
            next[existingIndex] = { id: columnId, direction: 'desc' };
            return multi ? next : [{ id: columnId, direction: 'desc' }];
          }
          if (multi) {
            return prev.filter((s) => s.id !== columnId);
          }
          return [];
        }

        const nextEntry: SortDescriptor = { id: columnId, direction: 'asc' };
        return multi ? [...prev, nextEntry] : [nextEntry];
      });
    },
    [enableSorting, enableMultiSort],
  );

  const handleFilterChange = useCallback((columnId: string, value: TableFilterValue) => {
    setFilters((prev) => ({ ...prev, [columnId]: value }));
    setPage(0);
  }, []);

  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const allVisibleSelected =
    pagedData.length > 0 &&
    pagedData.every((row, index) => {
      const absoluteIndex = enablePagination ? page * rowsPerPage + index : index;
      return selectedIds.has(getRowId(row, absoluteIndex));
    });

  const someVisibleSelected =
    pagedData.some((row, index) => {
      const absoluteIndex = enablePagination ? page * rowsPerPage + index : index;
      return selectedIds.has(getRowId(row, absoluteIndex));
    }) && !allVisibleSelected;

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        pagedData.forEach((row, index) => {
          const absoluteIndex = enablePagination ? page * rowsPerPage + index : index;
          next.delete(getRowId(row, absoluteIndex));
        });
      } else {
        pagedData.forEach((row, index) => {
          const absoluteIndex = enablePagination ? page * rowsPerPage + index : index;
          next.add(getRowId(row, absoluteIndex));
        });
      }
      return next;
    });
  };

  const toggleExpanded = (rowId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!resizingRef.current) return;
      const { columnId, startX, startWidth } = resizingRef.current;
      const column = columns.find((col) => col.id === columnId);
      const delta = event.clientX - startX;
      const min = column?.minWidth ?? 80;
      const max = column?.maxWidth ?? 800;
      const nextWidth = Math.min(max, Math.max(min, startWidth + delta));
      setColumnWidths((prev) => ({ ...prev, [columnId]: nextWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [columns]);

  const startResize = (columnId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;
    resizingRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: getWidth(column),
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const colSpan =
    visibleColumns.length +
    (enableRowSelection ? 1 : 0) +
    (enableExpanding ? 1 : 0);

  const filterableColumns = columns.filter((col) => col.filterable !== false && enableFiltering);
  const hasActiveFilters = Object.values(filters).some(isFilterActive);

  const renderHeaderCells = () => (
    <>
      {enableExpanding && (
        <TableCell padding="checkbox" sx={{ width: 48 }} aria-hidden />
      )}
      {enableRowSelection && (
        <TableCell padding="checkbox" sx={{ width: 48 }}>
          <Checkbox
            indeterminate={someVisibleSelected}
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            inputProps={{ 'aria-label': 'Select all rows on this page' }}
            size="small"
          />
        </TableCell>
      )}
      {visibleColumns.map((column) => {
        const sortState = sorting.find((s) => s.id === column.id);
        const sortIndex = sorting.findIndex((s) => s.id === column.id);
        const width = getWidth(column);

        return (
          <TableCell
            key={column.id}
            align={column.align ?? 'left'}
            sortDirection={sortState?.direction ?? false}
            sx={{
              width,
              minWidth: column.minWidth ?? 80,
              maxWidth: column.maxWidth,
              position: 'relative',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {enableSorting && column.sortable !== false ? (
              <TableSortLabel
                label={column.header}
                active={!!sortState}
                direction={sortState?.direction ?? 'asc'}
                sortIndex={sortIndex >= 0 ? sortIndex + 1 : undefined}
                showSortIndex={sorting.length > 1}
                onSort={(event) => handleSort(column.id, event)}
              />
            ) : (
              column.header
            )}
            {enableColumnResizing && (
              <Box
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${String(column.header)} column`}
                onMouseDown={(event) => startResize(column.id, event)}
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  height: '100%',
                  width: 6,
                  cursor: 'col-resize',
                  userSelect: 'none',
                  '&:hover': { bgcolor: 'primary.light', opacity: 0.5 },
                }}
              />
            )}
          </TableCell>
        );
      })}
    </>
  );

  const renderDataRow = (row: T, index: number, style?: React.CSSProperties) => {
    const absoluteIndex = enablePagination ? page * rowsPerPage + index : index;
    const rowId = getRowId(row, absoluteIndex);
    const selected = selectedIds.has(rowId);
    const expanded = expandedIds.has(rowId);

    return (
      <React.Fragment key={rowId}>
        <TableRow
          hover
          selected={selected}
          aria-selected={enableRowSelection ? selected : undefined}
          style={style}
          sx={{
            ...(style ? { display: 'flex', alignItems: 'center', boxSizing: 'border-box' } : null),
          }}
        >
          {enableExpanding && (
            <TableCell padding="checkbox" sx={style ? { width: 48, flexShrink: 0 } : undefined}>
              <IconButton
                size="small"
                onClick={() => toggleExpanded(rowId)}
                aria-label={expanded ? 'Collapse row' : 'Expand row'}
                aria-expanded={expanded}
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </TableCell>
          )}
          {enableRowSelection && (
            <TableCell padding="checkbox" sx={style ? { width: 48, flexShrink: 0 } : undefined}>
              <Checkbox
                checked={selected}
                onChange={() => toggleRowSelection(rowId)}
                inputProps={{ 'aria-label': `Select row ${rowId}` }}
                size="small"
              />
            </TableCell>
          )}
          {visibleColumns.map((column) => {
            const value = getCellValue(row, column);
            const width = getWidth(column);
            return (
              <TableCell
                key={column.id}
                align={column.align ?? 'left'}
                sx={{
                  width,
                  minWidth: column.minWidth ?? 80,
                  maxWidth: column.maxWidth,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(style
                    ? {
                        flex: `0 0 ${width}px`,
                        display: 'flex',
                        alignItems: 'center',
                      }
                    : null),
                }}
              >
                {column.cell
                  ? column.cell({ row, value, rowId })
                  : value == null
                    ? ''
                    : String(value)}
              </TableCell>
            );
          })}
        </TableRow>
        {enableExpanding && renderExpandedRow && (
          <TableRow>
            <TableCell colSpan={colSpan} sx={{ py: 0, borderBottom: expanded ? undefined : 0 }}>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{ py: 2, px: 1 }}>{renderExpandedRow(row)}</Box>
              </Collapse>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  };

  const toolbar = (
    <Toolbar
      variant={dense ? 'dense' : 'regular'}
      sx={{
        gap: 1,
        flexWrap: 'wrap',
        minHeight: dense ? 48 : 64,
        px: { xs: 1, sm: 2 },
      }}
    >
      {selectedIds.size > 0 && (
        <Chip
          label={`${selectedIds.size} selected`}
          onDelete={() => setSelectedIds(new Set())}
          color="primary"
          size="small"
        />
      )}
      {hasActiveFilters && (
        <Chip
          label="Filters active"
          onDelete={() => {
            setFilters({});
            setPage(0);
          }}
          size="small"
          variant="outlined"
        />
      )}
      <Box sx={{ flex: 1 }} />
      {toolbarContent}
      {enableColumnVisibility && (
        <>
          <Tooltip title="Toggle columns">
            <IconButton
              size="small"
              aria-label="Toggle column visibility"
              onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
            >
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={columnMenuAnchor}
            open={Boolean(columnMenuAnchor)}
            onClose={() => setColumnMenuAnchor(null)}
          >
            {columns
              .filter((col) => col.hideable !== false)
              .map((col) => (
                <MenuItem key={col.id} dense disableRipple>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={columnVisibility[col.id] !== false}
                        onChange={(event) =>
                          setColumnVisibility((prev) => ({
                            ...prev,
                            [col.id]: event.target.checked,
                          }))
                        }
                      />
                    }
                    label={col.header}
                  />
                </MenuItem>
              ))}
          </Menu>
        </>
      )}
    </Toolbar>
  );

  const filterBar =
    enableFiltering && filterableColumns.length > 0 ? (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
          px: 2,
          pb: 2,
        }}
      >
        {filterableColumns.map((column) => (
          <TableFilter
            key={column.id}
            columnId={column.id}
            label={typeof column.header === 'string' ? column.header : column.id}
            type={column.filterType ?? 'text'}
            value={
              filters[column.id] ??
              (column.filterType === 'dateRange' ? { start: null, end: null } : '')
            }
            onChange={handleFilterChange}
            options={column.filterOptions}
          />
        ))}
      </Box>
    ) : null;

  if (loading) {
    return (
      <Paper variant="outlined">
        {toolbar}
        <Box sx={{ p: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} sx={{ mb: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <ErrorIcon color="error" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          Something went wrong
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {error}
        </Typography>
        {onRetry && (
          <Button variant="outlined" onClick={onRetry}>
            Retry
          </Button>
        )}
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden' }}>
      {toolbar}
      {filterBar}

      {enableMultiSort && enableSorting && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', px: 2, pb: 1 }}
        >
          Tip: hold Shift and click column headers to sort by multiple columns.
        </Typography>
      )}

      <TableContainer
        sx={{
          maxHeight: useVirtual ? undefined : maxHeight,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {useVirtual ? (
          <Box role="table" aria-label={ariaLabel} sx={{ width: '100%' }}>
            <Box
              role="rowgroup"
              sx={{
                display: 'flex',
                borderBottom: 2,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                fontWeight: 600,
              }}
            >
              {enableRowSelection && (
                <Box
                  role="columnheader"
                  sx={{ width: 48, p: 1, display: 'flex', alignItems: 'center' }}
                >
                  <Checkbox
                    indeterminate={someVisibleSelected}
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    inputProps={{ 'aria-label': 'Select all rows on this page' }}
                    size="small"
                  />
                </Box>
              )}
              {visibleColumns.map((column) => {
                const sortState = sorting.find((s) => s.id === column.id);
                const sortIndex = sorting.findIndex((s) => s.id === column.id);
                const width = getWidth(column);
                return (
                  <Box
                    key={column.id}
                    role="columnheader"
                    aria-sort={
                      sortState
                        ? sortState.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    sx={{
                      width,
                      flex: `0 0 ${width}px`,
                      p: 2,
                      position: 'relative',
                      boxSizing: 'border-box',
                    }}
                  >
                    {enableSorting && column.sortable !== false ? (
                      <TableSortLabel
                        label={column.header}
                        active={!!sortState}
                        direction={sortState?.direction ?? 'asc'}
                        sortIndex={sortIndex >= 0 ? sortIndex + 1 : undefined}
                        showSortIndex={sorting.length > 1}
                        onSort={(event) => handleSort(column.id, event)}
                      />
                    ) : (
                      column.header
                    )}
                    {enableColumnResizing && (
                      <Box
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${String(column.header)} column`}
                        onMouseDown={(event) => startResize(column.id, event)}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: '100%',
                          width: 6,
                          cursor: 'col-resize',
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
            {pagedData.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <InboxIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
                <Typography color="text.secondary">{emptyMessage}</Typography>
              </Box>
            ) : (
              <VirtualList
                height={typeof maxHeight === 'number' ? maxHeight : 560}
                itemCount={pagedData.length}
                itemSize={rowHeight}
                width="100%"
                overscanCount={8}
              >
                {({ index, style }) => renderDataRow(pagedData[index], index, style)}
              </VirtualList>
            )}
          </Box>
        ) : (
          <Table
            stickyHeader={stickyHeader}
            size={dense ? 'small' : 'medium'}
            aria-label={ariaLabel}
            sx={{ minWidth: 560 }}
          >
            <TableHead>
              <TableRow>{renderHeaderCells()}</TableRow>
            </TableHead>
            <TableBody>
              {pagedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 6 }}>
                    <InboxIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
                    <Typography color="text.secondary">{emptyMessage}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pagedData.map((row, index) => renderDataRow(row, index))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {enablePagination && (
        <TablePagination
          count={sortedData.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={pageSizeOptions}
          onPageChange={setPage}
          onRowsPerPageChange={(next) => {
            setRowsPerPage(next);
            setPage(0);
          }}
        />
      )}

      {sortedData.length > 0 && hasActiveFilters && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Showing {sortedData.length} of {data.length} rows
        </Alert>
      )}
    </Paper>
  );
}

export const DataTable = React.memo(DataTableInner) as typeof DataTableInner & {
  displayName?: string;
};

DataTable.displayName = 'DataTable';

export default DataTable;
