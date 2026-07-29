import React from 'react';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { DataTable, type DataTableColumn } from '../DataTable';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

interface Row {
  id: string;
  name: string;
  status: string;
  amount: number;
  createdAt: string;
}

const rows: Row[] = [
  { id: '1', name: 'Alpha', status: 'active', amount: 100, createdAt: '2026-01-10' },
  { id: '2', name: 'Beta', status: 'paused', amount: 50, createdAt: '2026-02-01' },
  { id: '3', name: 'Gamma', status: 'active', amount: 200, createdAt: '2026-03-15' },
  { id: '4', name: 'Delta', status: 'closed', amount: 75, createdAt: '2026-01-20' },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', filterType: 'text' },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    filterType: 'select',
    filterOptions: [
      { label: 'Active', value: 'active' },
      { label: 'Paused', value: 'paused' },
      { label: 'Closed', value: 'closed' },
    ],
  },
  { id: 'amount', header: 'Amount', accessorKey: 'amount', filterable: false },
];

describe('components/DataTable', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders headers and rows', () => {
    renderWithTheme(
      <DataTable data={rows} columns={columns} getRowId={(row) => row.id} enablePagination={false} />
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Delta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument();
  });

  it('sorts a column ascending then descending', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <DataTable data={rows} columns={columns} getRowId={(row) => row.id} enablePagination={false} />
    );

    const amountHeader = screen.getByRole('button', { name: /amount/i });
    await user.click(amountHeader);

    const table = screen.getByRole('table');
    let bodyRows = within(table).getAllByRole('row').slice(1);
    expect(within(bodyRows[0]).getByText('Beta')).toBeInTheDocument();

    await user.click(amountHeader);
    bodyRows = within(table).getAllByRole('row').slice(1);
    expect(within(bodyRows[0]).getByText('Gamma')).toBeInTheDocument();
  });

  it('supports multi-column sorting with shift-click', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <DataTable data={rows} columns={columns} getRowId={(row) => row.id} enablePagination={false} />
    );

    await user.click(screen.getByRole('button', { name: /status/i }));
    fireEvent.click(screen.getByRole('button', { name: /amount/i }), { shiftKey: true });

    expect(screen.getByLabelText('Sort priority 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort priority 2')).toBeInTheDocument();
  });

  it('filters rows with text search', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <DataTable data={rows} columns={columns} getRowId={(row) => row.id} enablePagination={false} />
    );

    const nameFilter = screen.getByLabelText(/name filter/i);
    await user.type(nameFilter, 'bet');

    await waitFor(() => {
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });
  });

  it('selects rows via checkboxes', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();

    renderWithTheme(
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        enableRowSelection
        enablePagination={false}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getByLabelText('Select row 1'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('paginates results', async () => {
    const user = userEvent.setup();
    const manyRows = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      name: `Row ${i + 1}`,
      status: 'active',
      amount: i,
      createdAt: '2026-01-01',
    }));

    renderWithTheme(
      <DataTable
        data={manyRows}
        columns={columns}
        getRowId={(row) => row.id}
        enablePagination
        pageSize={10}
      />
    );

    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.queryByText('Row 11')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Row 11')).toBeInTheDocument();
  });

  it('persists sort state to localStorage', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        persistKey="test-table"
        enablePagination={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /name/i }));

    await waitFor(() => {
      const stored = window.localStorage.getItem('datatable_test-table');
      expect(stored).toBeTruthy();
      expect(stored).toContain('"id":"name"');
    });
  });

  it('shows empty state message', () => {
    renderWithTheme(
      <DataTable
        data={[]}
        columns={columns}
        emptyMessage="Nothing here"
        enablePagination={false}
      />
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows error state with retry', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();

    renderWithTheme(
      <DataTable data={rows} columns={columns} error="Failed to load" onRetry={onRetry} />
    );

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
