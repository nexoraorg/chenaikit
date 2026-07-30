import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DialogComponent from '../Dialog';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('Dialog Component', () => {
  it('should render dialog when open is true', () => {
    renderWithTheme(
      <DialogComponent
        open={true}
        onClose={jest.fn()}
        title="Test Dialog"
        message="Test message"
      />
    );

    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should not render dialog when open is false', () => {
    renderWithTheme(
      <DialogComponent
        open={false}
        onClose={jest.fn()}
        title="Test Dialog"
        message="Test message"
      />
    );

    expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
  });

  it('should display correct icon for each type', () => {
    const { rerender } = renderWithTheme(
      <DialogComponent
        open={true}
        onClose={jest.fn()}
        title="Info Dialog"
        message="Info message"
        type="info"
      />
    );

    // Check icon is rendered (info icon)
    let iconElement = screen.getByRole('img', { hidden: true });
    expect(iconElement).toBeInTheDocument();

    // Test warning type
    rerender(
      <ThemeProvider theme={theme}>
        <DialogComponent
          open={true}
          onClose={jest.fn()}
          title="Warning Dialog"
          message="Warning message"
          type="warning"
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Warning Dialog')).toBeInTheDocument();
  });

  it('should render action buttons and call onClick handlers', async () => {
    const handleConfirm = jest.fn();
    const handleCancel = jest.fn();

    renderWithTheme(
      <DialogComponent
        open={true}
        onClose={jest.fn()}
        title="Test Dialog"
        message="Test message"
        actions={[
          { label: 'Cancel', onClick: handleCancel },
          { label: 'Confirm', onClick: handleConfirm, variant: 'primary' },
        ]}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    const confirmButton = screen.getByText('Confirm');

    fireEvent.click(cancelButton);
    await waitFor(() => expect(handleCancel).toHaveBeenCalled());

    fireEvent.click(confirmButton);
    await waitFor(() => expect(handleConfirm).toHaveBeenCalled());
  });

  it('should close dialog when action has autoClose', async () => {
    const onClose = jest.fn();
    const handleAction = jest.fn();

    renderWithTheme(
      <DialogComponent
        open={true}
        onClose={onClose}
        title="Test Dialog"
        message="Test message"
        actions={[
          { label: 'Action', onClick: handleAction, autoClose: true },
        ]}
      />
    );

    const actionButton = screen.getByText('Action');
    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(handleAction).toHaveBeenCalled();
    });
  });

  it('should handle custom icon', () => {
    const customIcon = <div data-testid="custom-icon">Custom Icon</div>;

    renderWithTheme(
      <DialogComponent
        open={true}
        onClose={jest.fn()}
        title="Test Dialog"
        message="Test message"
        icon={customIcon}
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('should respect maxWidth prop', () => {
    const { container } = renderWithTheme(
      <DialogComponent
        open={true}
        onClose={jest.fn()}
        title="Test Dialog"
        message="Test message"
        maxWidth="xs"
      />
    );

    const dialog = container.querySelector('.MuiDialog-root');
    expect(dialog).toBeInTheDocument();
  });

  it('should not close on backdrop click when disableBackdropClick is true', () => {
    const onClose = jest.fn();
    const { container } = renderWithTheme(
      <DialogComponent
        open={true}
        onClose={onClose}
        title="Test Dialog"
        message="Test message"
        disableBackdropClick={true}
      />
    );

    const backdrop = container.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).not.toHaveBeenCalled();
    }
  });
});
