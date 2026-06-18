import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
  ExpandedState,
  VisibilityState,
  ColumnDef,
  FilterFn,
  Row,
} from '@tanstack/react-table';
import { List, useListRef } from 'react-window';
import {
  Box,
  Checkbox,
  Typography,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  FormControlLabel,
  Switch,
  Paper,
  Chip,
  Divider,
  useTheme,
  Button,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ViewColumn as ViewColumnIcon,
  Refresh as RefreshIcon,
  Inbox as InboxIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';

import TableSortLabel from './TableSortLabel';
import TableFilter from './TableFilter';
import TablePagination from './TablePagination';
import type { FilterType, FilterOption, FilterValue, DateRangeValue } from './TableFilter';

export interface Column<T> {
  id?: string;
  accessorKey?: string;
  accessorFn?: (row: T) => unknown;
  header: string;
  cell?: (value: unknown, row: T) => React.ReactNode;
  enableSorting?: boolean;
  enableFilter?: boolean;
  filterType?: FilterType;
  filterOptions?: FilterOption[];
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableHiding?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  error?: string | null;
  onRetry?: () => void;

  enableSorting?: boolean;
  enableMultiSort?: boolean;
  enableFiltering?: boolean;
  enableRowSelection?: boolean;
  enableExpandableRows?: boolean;
  enableColumnResizing?: boolean;
  enableColumnVisibility?: boolean;
  enablePagination?: boolean;
  enableVirtualization?: boolean;

  rowHeight?: number;
  tableHeight?: number | string;
  virtualizationThreshold?: number;

  pageSize?: number;
  pageSizeOptions?: number[];

  selectedRowIds?: Set<string>;
  onSelectionChange?: (selectedRowIds: Set<string>) => void;

  renderSubRow?: (row: T) => React.ReactNode;
  getRowId?: (row: T, index: number) => string;

  persistKey?: string;

  getRowProps?: (row: T) => Record<string, unknown>;

  density?: 'compact' | 'standard' | 'comfortable';
}

const ROW_HEIGHTS: Record<string, number> = {
  compact: 40,
  standard: 52,
  comfortable: 64,
};

const DEFAULT_CELL_PADDINGS: Record<string, { px: number; py: number }> = {
  compact: { px: 1, py: 0.5 },
  standard: { px: 2, py: 1 },
  comfortable: { px: 2, py: 1.5 },
};

function dateRangeFilterFn<T>(
  row: Row<T>,
  columnId: string,
  filterValue: DateRangeValue
): boolean {
  if (!filterValue?.start && !filterValue?.end) return true;
  const value = row.getValue(columnId);
  if (!value) return false;
  const d = new Date(String(value)).getTime();
  if (filterValue.start && d < new Date(filterValue.start).getTime()) return false;
  if (filterValue.end && d > new Date(filterValue.end).getTime()) return false;
  return true;
}

function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data',
  error = null,
  onRetry,

  enableSorting = true,
  enableMultiSort = false,
  enableFiltering = false,
  enableRowSelection = false,
  enableExpandableRows = false,
  enableColumnResizing = false,
  enableColumnVisibility = false,
  enablePagination = false,
  enableVirtualization = false,

  rowHeight,
  tableHeight = 500,
  virtualizationThreshold = 200,

  pageSize: initialPageSize = 25,
  pageSizeOptions,

  selectedRowIds: externalSelectedRowIds,
  onSelectionChange,

  renderSubRow,
  getRowId,

  persistKey,

  getRowProps,

  density = 'standard',
}: DataTableProps<T>) {
  const theme = useTheme();
  const listRef = useListRef();

  const effectiveRowHeight = rowHeight || ROW_HEIGHTS[density];
  const cellPadding = DEFAULT_CELL_PADDINGS[density];

  const [sorting, setSorting] = useState<SortingState>(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(`datatable_sort_${persistKey}`);
        return saved ? (JSON.parse(saved) as SortingState) : [];
      } catch { return []; }
    }
    return [];
  });

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(`datatable_filters_${persistKey}`);
        return saved ? (JSON.parse(saved) as ColumnFiltersState) : [];
      } catch { return []; }
    }
    return [];
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const columnMenuOpen = Boolean(anchorEl);

  useEffect(() => {
    if (persistKey && sorting.length > 0) {
      localStorage.setItem(`datatable_sort_${persistKey}`, JSON.stringify(sorting));
    }
  }, [sorting, persistKey]);

  useEffect(() => {
    if (persistKey && columnFilters.length > 0) {
      localStorage.setItem(`datatable_filters_${persistKey}`, JSON.stringify(columnFilters));
    }
  }, [columnFilters, persistKey]);

  useEffect(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(`datatable_visibility_${persistKey}`);
        if (saved) setColumnVisibility(JSON.parse(saved));
      } catch {
        localStorage.removeItem(`datatable_visibility_${persistKey}`);
      }
    }
  }, [persistKey]);
    }
  }, [persistKey]);

  useEffect(() => {
    if (persistKey && Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(`datatable_visibility_${persistKey}`, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, persistKey]);

  const tanstackColumns = useMemo<ColumnDef<T>[]>(() => {
    const result: ColumnDef<T>[] = [];

    if (enableRowSelection) {
      result.push({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            size="small"
            inputProps={{ 'aria-label': 'Select all rows' }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            size="small"
            inputProps={{ 'aria-label': `Select row ${row.id}` }}
          />
        ),
        size: 48,
        minSize: 40,
        maxSize: 60,
        enableSorting: false,
        enableColumnFilter: false,
        enableResizing: false,
      });
    }

    if ((enableExpandableRows || renderSubRow) && !columns.some(c => c.id === 'expander')) {
      result.push({
        id: 'expander',
        header: '',
        cell: ({ row }) => {
          if (!row.getCanExpand()) return null;
          return (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
            >
              {row.getIsExpanded() ? <ExpandMoreIcon /> : <ChevronRightIcon />}
            </IconButton>
          );
        },
        size: 48,
        minSize: 40,
        maxSize: 60,
        enableSorting: false,
        enableColumnFilter: false,
        enableResizing: false,
      });
    }

    columns.forEach((col) => {
      const colDef: ColumnDef<T> = {
        id: col.id || (col.accessorKey as string) || col.header,
        accessorKey: col.accessorKey as string | undefined,
        accessorFn: col.accessorFn,
        header: col.header,
        size: col.size,
        minSize: col.minSize,
        maxSize: col.maxSize,
        enableSorting: col.enableSorting ?? enableSorting,
        enableColumnFilter: col.enableFilter ?? enableFiltering,
        enableResizing: col.enableHiding ?? enableColumnResizing,
        enableHiding: col.enableHiding ?? enableColumnVisibility,
        cell: (info) => {
          if (col.cell) {
            return col.cell(info.getValue(), info.row.original);
          }
          const v = info.getValue();
          if (v === null || v === undefined) return <Typography variant="body2" color="text.disabled">—</Typography>;
          return String(v);
        },
        filterFn: col.filterType === 'date-range'
          ? (dateRangeFilterFn as FilterFn<T>)
          : col.filterType === 'select'
            ? 'equalsString'
            : 'includesString',
      };
      result.push(colDef);
    });

    return result;
  }, [columns, enableRowSelection, enableExpandableRows, renderSubRow, enableSorting, enableFiltering, enableColumnResizing, enableColumnVisibility]);

  const getRowIdFn = useCallback(
    (row: T, index: number, parent?: Row<T>) => {
      if (getRowId) return getRowId(row, index);
      return String(index);
    },
    [getRowId]
  );

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      expanded,
      columnVisibility,
      globalFilter,
      pagination: enablePagination ? pagination : undefined,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: enablePagination ? setPagination : undefined,
    getRowId: getRowIdFn,
    getRowCanExpand: renderSubRow ? () => true : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getExpandedRowModel: (enableExpandableRows || renderSubRow) ? getExpandedRowModel() : undefined,
    enableSorting,
    enableMultiSort,
    enableRowSelection,
    enableExpanding: !!(enableExpandableRows || renderSubRow),
    globalFilterFn: 'includesString',
  });

  const selectedRowCount = Object.keys(rowSelection).length;

  useEffect(() => {
    if (onSelectionChange) {
      const ids = new Set<string>();
      Object.entries(rowSelection).forEach(([id, selected]) => {
        if (selected) ids.add(id);
      });
      onSelectionChange(ids);
    }
  }, [rowSelection, onSelectionChange]);

  const handleToggleSort = useCallback(
    (columnId: string, shiftKey: boolean) => {
      setSorting((prev) => {
        const existing = prev.findIndex(s => s.id === columnId);
        if (existing >= 0) {
          const current = prev[existing];
          if (current.desc) {
            if (enableMultiSort && shiftKey && prev.length > 1) {
              return prev.filter(s => s.id !== columnId);
            }
            return prev.map(s => s.id === columnId ? { ...s, desc: false } : s);
          }
          return prev.map(s => s.id === columnId ? { ...s, desc: true } : s);
        }
        if (enableMultiSort && shiftKey) {
          return [...prev, { id: columnId, desc: false }];
        }
        return [{ id: columnId, desc: false }];
      });
    },
    [enableMultiSort]
  );

  const handleFilterChange = useCallback(
    (columnId: string, value: FilterValue) => {
      setColumnFilters((prev) => {
        const existing = prev.filter(f => f.id !== columnId);
        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          return existing;
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          const dv = value as DateRangeValue;
          if (!dv.start && !dv.end) return existing;
        }
        return [...existing, { id: columnId, value }];
      });
    },
    []
  );

  const rows = table.getRowModel().rows;
  const pageRows = enablePagination ? rows : rows;
  const totalRows = enablePagination ? table.getFilteredRowModel().rows.length : data.length;

  const shouldVirtualize = enableVirtualization && rows.length > virtualizationThreshold;

  const columnWidths = useMemo(() => {
    const allColumns = table.getAllColumns();
    const widths: Record<string, number | string> = {};
    allColumns.forEach((col) => {
      widths[col.id] = col.getSize();
    });
    return widths;
  }, [table, tanstackColumns]);

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={effectiveRowHeight - 8}
              sx={{ mb: 1, borderRadius: 0.5 }}
            />
          ))}
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" color="error.main" gutterBottom>
          Error loading data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {error}
        </Typography>
        {onRetry && (
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry}>
            Retry
          </Button>
        )}
      </Paper>
    );
  }

  const renderHeaderRow = () => (
    <Box
      sx={{
        display: 'flex',
        borderBottom: 2,
        borderColor: 'divider',
        bgcolor: 'action.selected',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}
      role="row"
    >
      {table.getHeaderGroups().map(headerGroup =>
        headerGroup.headers.map(header => {
          const width = columnWidths[header.column.id];
          const column = columns.find(c => (c.id || c.accessorKey) === header.column.id);
          return (
            <Box
              key={header.id}
              role="columnheader"
              aria-sort={
                header.column.getIsSorted()
                  ? header.column.getIsSorted() === 'asc' ? 'ascending' : 'descending'
                  : undefined
              }
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: cellPadding.px,
                py: cellPadding.py,
                width: typeof width === 'number' ? width : undefined,
                minWidth: header.column.columnDef.minSize || 80,
                maxWidth: header.column.columnDef.maxSize,
                flex: typeof width === 'number' ? '0 0 auto' : '1 1 150px',
                position: 'relative',
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {header.isPlaceholder ? null : header.id === 'select' || header.id === 'expander' ? (
                flexRender(header.column.columnDef.header, header.getContext())
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
                  <TableSortLabel
                    columnId={header.column.id}
                    label={String(flexRender(header.column.columnDef.header, header.getContext()))}
                    sortDirections={sorting}
                    multiSortEnabled={!!enableMultiSort}
                    onToggleSort={handleToggleSort}
                  />
                  {enableFiltering && column?.enableFilter !== false && (
                    <TableFilter
                      columnId={header.column.id}
                      filterType={column?.filterType || 'text'}
                      value={columnFilters.find(f => f.id === header.column.id)?.value as FilterValue}
                      onChange={(value) => handleFilterChange(header.column.id, value)}
                      options={column?.filterOptions}
                      placeholder={`Filter ${String(flexRender(header.column.columnDef.header, header.getContext()))}`}
                    />
                  )}
                </Box>
              )}
              {enableColumnResizing && header.column.getCanResize() && (
                <Box
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    cursor: 'col-resize',
                    bgcolor: 'divider',
                    '&:hover': { bgcolor: 'primary.main' },
                    transition: 'background-color 0.15s',
                  }}
                  role="separator"
                  aria-label={`Resize column ${String(flexRender(header.column.columnDef.header, header.getContext()))}`}
                />
              )}
            </Box>
          );
        })
      )}
    </Box>
  );

  const renderRow = React.memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = pageRows[index];
    if (!row) return null;

    const rowProps = getRowProps ? getRowProps(row.original) : {};
    const isSelected = row.getIsSelected();
    const isExpanded = row.getIsExpanded();

    return (
      <Box
        role="row"
        aria-selected={isSelected}
        sx={{
          display: 'flex',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: isSelected ? 'action.selected' : 'inherit',
          '&:hover': { bgcolor: isSelected ? 'action.selected' : 'action.hover' },
          transition: 'background-color 0.15s',
          ...style,
          ...rowProps,
        }}
        onClick={enableExpandableRows ? () => row.toggleExpanded() : undefined}
        style={style}
      >
        {row.getVisibleCells().map(cell => {
          const width = columnWidths[cell.column.id];
          return (
            <Box
              key={cell.id}
              role="cell"
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: cellPadding.px,
                py: cellPadding.py,
                width: typeof width === 'number' ? width : undefined,
                minWidth: cell.column.columnDef.minSize || 80,
                maxWidth: cell.column.columnDef.maxSize,
                flex: typeof width === 'number' ? '0 0 auto' : '1 1 150px',
                fontSize: '0.875rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </Box>
          );
        })}
      </Box>
    );
  });
  renderRow.displayName = 'DataTableRow';

  const renderNonVirtualizedTable = () => (
    <Box sx={{ overflow: 'auto', maxHeight: tableHeight }}>
      <Box role="table" sx={{ minWidth: 'fit-content', width: '100%' }}>
        {renderHeaderRow()}
        {pageRows.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            <InboxIcon sx={{ fontSize: 48, mb: 2, opacity: 0.4 }} />
            <Typography variant="h6" color="text.secondary">
              {emptyMessage}
            </Typography>
          </Box>
        ) : (
          <>
            {pageRows.map((row, i) => (
              <React.Fragment key={row.id}>
                <Box
                  role="row"
                  aria-selected={row.getIsSelected()}
                  sx={{
                    display: 'flex',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: row.getIsSelected() ? 'action.selected' : 'inherit',
                    '&:hover': {
                      bgcolor: row.getIsSelected() ? 'action.selected' : 'action.hover',
                    },
                    transition: 'background-color 0.15s',
                    ...(getRowProps ? getRowProps(row.original) : {}),
                  }}
                  onClick={enableExpandableRows ? () => row.toggleExpanded() : undefined}
                >
                  {row.getVisibleCells().map(cell => {
                    const width = columnWidths[cell.column.id];
                    return (
                      <Box
                        key={cell.id}
                        role="cell"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          px: cellPadding.px,
                          py: cellPadding.py,
                          width: typeof width === 'number' ? width : undefined,
                          minWidth: cell.column.columnDef.minSize || 80,
                          maxWidth: cell.column.columnDef.maxSize,
                          flex: typeof width === 'number' ? '0 0 auto' : '1 1 150px',
                          fontSize: '0.875rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Box>
                    );
                  })}
                </Box>
                {row.getIsExpanded() && renderSubRow && (
                  <Box
                    sx={{
                      display: 'flex',
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: 'grey.50',
                      px: cellPadding.px,
                      py: cellPadding.py,
                    }}
                  >
                    {renderSubRow(row.original)}
                  </Box>
                )}
              </React.Fragment>
            ))}
          </>
        )}
      </Box>
    </Box>
  );

  const renderVirtualizedTable = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: tableHeight }}>
      <Box sx={{ flexShrink: 0 }}>
        {renderHeaderRow()}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {pageRows.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary',
            }}
          >
            <InboxIcon sx={{ fontSize: 48, mb: 2, opacity: 0.4 }} />
            <Typography variant="h6" color="text.secondary">
              {emptyMessage}
            </Typography>
          </Box>
        ) : (
          <List
            rowCount={pageRows.length}
            rowHeight={effectiveRowHeight}
            rowComponent={renderRow as React.ComponentType<{ index: number; style: React.CSSProperties }>}
            rowProps={{} as Record<string, unknown>}
            overscanCount={10}
            listRef={listRef}
          />
        )}
      </Box>
    </Box>
  );

  const selectedInfo = selectedRowCount > 0 ? `${selectedRowCount} selected` : null;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 48,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {selectedInfo && (
            <Chip
              label={selectedInfo}
              size="small"
              color="primary"
              onDelete={() => {
                setRowSelection({});
                table.resetRowSelection();
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {enableColumnVisibility && (
            <>
              <Tooltip title="Column visibility">
                <IconButton
                  size="small"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  aria-label="Toggle column visibility"
                >
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={columnMenuOpen}
                onClose={() => setAnchorEl(null)}
              >
                {table.getAllLeafColumns()
                  .filter(col => col.id !== 'select' && col.id !== 'expander' && col.getCanHide())
                  .map(col => (
                    <MenuItem key={col.id} dense>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={col.getIsVisible()}
                            onChange={col.getToggleVisibilityHandler()}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            {String(flexRender(col.columnDef.header, { column: col, header: col.columnDef.header, table } as any)) || col.id}
                          </Typography>
                        }
                        sx={{ ml: 0 }}
                      />
                    </MenuItem>
                  ))}
              </Menu>
            </>
          )}
        </Box>
      </Box>

      {shouldVirtualize ? renderVirtualizedTable() : renderNonVirtualizedTable()}

      {enablePagination && (
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalRows={totalRows}
          onPageChange={(page) => setPagination(prev => ({ ...prev, pageIndex: page }))}
          onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </Paper>
  );
}

export default DataTable;
