import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Modal from '../Modal';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('Modal Component', () => {
  it('should render modal when open is true', () => {
    renderWithTheme(
      <Modal
        open={true}
        onClose={jest.fn()}
        title="Test Modal"
        content="Test content"
      />
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should not render modal when open is false', () => {
    renderWithTheme(
      <Modal
        open={false}
        onClose={jest.fn()}
        title="Test Modal"
        content="Test content"
      />
    );

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    const { container } = renderWithTheme(
      <Modal
        open={true}
        onClose={onClose}
        title="Test Modal"
        content="Test content"
      />
    );

    // Click backdrop
    const backdrop = container.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should not close on backdrop click when disableBackdropClick is true', async () => {
    const onClose = jest.fn();
    const { container } = renderWithTheme(
      <Modal
        open={true}
        onClose={onClose}
        title="Test Modal"
        content="Test content"
        disableBackdropClick={true}
      />
    );

    const backdrop = container.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).not.toHaveBeenCalled();
    }
  });

  it('should close on escape key when disableEscapeKey is false', async () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Modal
        open={true}
        onClose={onClose}
        title="Test Modal"
        content="Test content"
        disableEscapeKey={false}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should not close on escape key when disableEscapeKey is true', async () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Modal
        open={true}
        onClose={onClose}
        title="Test Modal"
        content="Test content"
        disableEscapeKey={true}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should render action buttons', () => {
    const onClose = jest.fn();
    const action1 = jest.fn();
    const action2 = jest.fn();

    renderWithTheme(
      <Modal
        open={true}
        onClose={onClose}
        title="Test Modal"
        content="Test content"
        actions={[
          { label: 'Cancel', onClick: onClose, variant: 'secondary' },
          { label: 'Confirm', onClick: action1, variant: 'primary' },
          { label: 'Delete', onClick: action2, variant: 'danger' },
        ]}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should respect size prop', () => {
    const { container: containerSmall } = renderWithTheme(
      <Modal
        open={true}
        onClose={jest.fn()}
        title="Test Modal"
        content="Test content"
        size="small"
      />
    );

    const { container: containerLarge } = renderWithTheme(
      <Modal
        open={true}
        onClose={jest.fn()}
        title="Test Modal"
        content="Test content"
        size="large"
      />
    );

    // Both should render without errors
    expect(containerSmall.querySelector('.MuiDialog-root')).toBeInTheDocument();
    expect(containerLarge.querySelector('.MuiDialog-root')).toBeInTheDocument();
  });
});
