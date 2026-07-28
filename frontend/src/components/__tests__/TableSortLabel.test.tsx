import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { TableSortLabel } from '../TableSortLabel';
import { TablePagination } from '../TablePagination';

const theme = createTheme();
const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('components/TableSortLabel', () => {
  it('renders label and invokes onSort', async () => {
    const user = userEvent.setup();
    const onSort = jest.fn();

    renderWithTheme(
      <TableSortLabel label="Amount" active direction="asc" onSort={onSort} />
    );

    await user.click(screen.getByRole('button', { name: /amount/i }));
    expect(onSort).toHaveBeenCalled();
  });

  it('shows multi-sort priority badge', () => {
    renderWithTheme(
      <TableSortLabel label="Name" active direction="desc" sortIndex={2} showSortIndex />
    );

    expect(screen.getByLabelText('Sort priority 2')).toHaveTextContent('2');
  });
});

describe('components/TablePagination', () => {
  it('renders range and navigates pages', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    const onRowsPerPageChange = jest.fn();

    renderWithTheme(
      <TablePagination
        count={100}
        page={1}
        rowsPerPage={25}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
    );

    expect(screen.getByText('26–50 of 100')).toBeInTheDocument();

    await user.click(screen.getByLabelText('First page'));
    expect(onPageChange).toHaveBeenCalledWith(0);

    await user.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
