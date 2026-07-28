import React, { memo, useMemo } from 'react';
import { FixedSizeList as List, FixedSizeListProps } from 'react-window';
import { Box, Typography } from '@mui/material';

// Virtualized list component for performance optimization
interface VirtualizedListProps<T> extends Omit<FixedSizeListProps, 'children'> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
}

export const VirtualizedList = memo(<T,>({
  items,
  itemHeight,
  renderItem,
  emptyMessage = 'No items to display',
  loading = false,
  ...listProps
}: VirtualizedListProps<T>) => {
  const itemCount = items.length;

  const Row = useMemo(() => ({ index, style }: { index: number; style: React.CSSProperties }) => {
    return (
      <div style={style}>
        {renderItem(items[index], index)}
      </div>
    );
  }, [items, renderItem]);

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  if (itemCount === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <List
      itemCount={itemCount}
      itemSize={itemHeight}
      {...listProps}
    >
      {Row}
    </List>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

// Virtualized table component for large datasets
interface VirtualizedTableProps<T> {
  data: T[];
  columns: Array<{
    key: keyof T | 'actions';
    header: string;
    width?: number | string;
    render?: (item: T) => React.ReactNode;
  }>;
  rowHeight?: number;
  headerHeight?: number;
  emptyMessage?: string;
}

export const VirtualizedTable = memo(<T,>({
  data,
  columns,
  rowHeight = 52,
  headerHeight = 56,
  emptyMessage = 'No data available',
}: VirtualizedTableProps<T>) => {
  const totalWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const width = typeof col.width === 'number' ? col.width : 150;
      return sum + width;
    }, 0);
  }, [columns]);

  const Row = useMemo(() => ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = data[index];
    return (
      <Box
        style={style}
        sx={{
          display: 'flex',
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        {columns.map((column) => (
          <Box
            key={String(column.key)}
            sx={{
              width: column.width || 150,
              p: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {column.render ? column.render(item) : String(item[column.key] || '')}
          </Box>
        ))}
      </Box>
    );
  }, [data, columns]);

  const Header = useMemo(() => () => (
    <Box
      sx={{
        display: 'flex',
        borderBottom: '2px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      {columns.map((column) => (
        <Box
          key={String(column.key)}
          sx={{
            width: column.width || 150,
            p: 2,
            fontWeight: 600,
          }}
        >
          {column.header}
        </Box>
      ))}
    </Box>
  ), [columns]);

  if (data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      <Header />
      <List
        height={400}
        itemCount={data.length}
        itemSize={rowHeight}
        width={totalWidth}
      >
        {Row}
      </List>
    </Box>
  );
});

VirtualizedTable.displayName = 'VirtualizedTable';

export default VirtualizedList;