import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ConfirmDialog from '../ConfirmDialog';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ConfirmDialog Component', () => {
  it('should render confirm dialog when open is true', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={jest.fn()}
        title="Confirm Action"
        message="Are you sure?"
      />
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should not render dialog when open is false', () => {
    renderWithTheme(
      <ConfirmDialog
        open={false}
        onConfirm={jest.fn()}
        title="Confirm Action"
        message="Are you sure?"
      />
    );

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirm = jest.fn();
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={onConfirm}
        title="Confirm Action"
        message="Are you sure?"
        confirmLabel="Yes"
      />
    );

    const confirmButton = screen.getByText('Yes');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const onCancel = jest.fn();
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={jest.fn()}
        onCancel={onCancel}
        title="Confirm Action"
        message="Are you sure?"
        cancelLabel="No"
      />
    );

    const cancelButton = screen.getByText('No');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  it('should show confirmation input when requireConfirmation is true', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={jest.fn()}
        title="Confirm Action"
        message="This is dangerous"
        requireConfirmation={true}
        confirmationText="DELETE"
      />
    );

    expect(screen.getByPlaceholderText('Type "DELETE"')).toBeInTheDocument();
  });

  it('should disable confirm button until confirmation text is entered', async () => {
    const onConfirm = jest.fn();
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={onConfirm}
        title="Confirm Action"
        message="This is dangerous"
        requireConfirmation={true}
        confirmationText="DELETE"
        confirmLabel="Confirm"
      />
    );

    const confirmButton = screen.getByText('Confirm') as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    const input = screen.getByPlaceholderText('Type "DELETE"');
    await userEvent.type(input, 'DELETE');

    await waitFor(() => {
      expect(confirmButton.disabled).toBe(false);
    });
  });

  it('should show warning icon when isDangerous is true', () => {
    const { container } = renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={jest.fn()}
        title="Dangerous Action"
        message="This action cannot be undone"
        isDangerous={true}
      />
    );

    // Warning icon should be present
    const warningIcon = container.querySelector('[data-testid="WarningIcon"]');
    expect(container.textContent).toContain('Dangerous Action');
  });

  it('should handle async onConfirm', async () => {
    const onConfirm = jest.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={onConfirm}
        title="Confirm Action"
        message="Please wait..."
        confirmLabel="Confirm"
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it('should disable buttons when isLoading is true', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={jest.fn()}
        title="Loading"
        message="Processing..."
        isLoading={true}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
      />
    );

    const confirmButton = screen.getByText('Confirm') as HTMLButtonElement;
    const cancelButton = screen.getByText('Cancel') as HTMLButtonElement;

    expect(confirmButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
  });

  it('should clear input on cancel', async () => {
    const onCancel = jest.fn();
    const { rerender } = renderWithTheme(
      <ConfirmDialog
        open={true}
        onConfirm={jest.fn()}
        onCancel={onCancel}
        title="Confirm"
        message="Confirm action"
        requireConfirmation={true}
        confirmationText="YES"
        cancelLabel="Cancel"
      />
    );

    const input = screen.getByPlaceholderText('Type "YES"') as HTMLInputElement;
    await userEvent.type(input, 'YES');

    expect(input.value).toBe('YES');

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
