import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import FormModal, { FormStep } from '../FormModal';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockSteps: FormStep[] = [
  {
    label: 'Step 1',
    component: <div>Step 1 Content</div>,
    validation: () => true,
  },
  {
    label: 'Step 2',
    component: <div>Step 2 Content</div>,
    validation: () => true,
  },
  {
    label: 'Step 3',
    component: <div>Step 3 Content</div>,
    validation: () => true,
  },
];

describe('FormModal Component', () => {
  it('should render form modal when open is true', () => {
    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
      />
    );

    expect(screen.getByText('Form Modal')).toBeInTheDocument();
    expect(screen.getByText('Step 1 Content')).toBeInTheDocument();
  });

  it('should not render modal when open is false', () => {
    renderWithTheme(
      <FormModal
        open={false}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
      />
    );

    expect(screen.queryByText('Form Modal')).not.toBeInTheDocument();
  });

  it('should navigate to next step when Next button is clicked', async () => {
    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
      />
    );

    expect(screen.getByText('Step 1 Content')).toBeInTheDocument();

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Step 2 Content')).toBeInTheDocument();
    });
  });

  it('should navigate to previous step when Previous button is clicked', async () => {
    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
      />
    );

    // Go to step 2
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByText('Step 2 Content')).toBeInTheDocument();
    });

    // Go back to step 1
    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);

    await waitFor(() => {
      expect(screen.getByText('Step 1 Content')).toBeInTheDocument();
    });
  });

  it('should call onSubmit on last step', async () => {
    const onSubmit = jest.fn();
    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        title="Form Modal"
        steps={mockSteps}
      />
    );

    // Navigate to last step
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByText('Step 2 Content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByText('Step 3 Content')).toBeInTheDocument();
    });

    // Submit
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it('should validate step before moving to next', async () => {
    const invalidStep: FormStep = {
      label: 'Invalid Step',
      component: <div>Invalid Content</div>,
      validation: () => false,
    };

    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={[invalidStep, ...mockSteps]}
      />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Please complete all required fields')).toBeInTheDocument();
    });
  });

  it('should show progress when showProgress is true', () => {
    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
        showProgress={true}
      />
    );

    // Stepper should be present
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('should hide progress when showProgress is false', () => {
    const { container } = renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
        showProgress={false}
      />
    );

    const stepper = container.querySelector('.MuiStepper-root');
    expect(stepper).not.toBeInTheDocument();
  });

  it('should disable Previous button on first step', () => {
    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
      />
    );

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });

  it('should call step lifecycle methods', async () => {
    const onNext = jest.fn();
    const onPrevious = jest.fn();

    const stepsWithLifecycle: FormStep[] = [
      {
        label: 'Step 1',
        component: <div>Step 1</div>,
        validation: () => true,
        onNext,
      },
      {
        label: 'Step 2',
        component: <div>Step 2</div>,
        validation: () => true,
        onPrevious,
      },
    ];

    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={stepsWithLifecycle}
      />
    );

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Previous'));

    await waitFor(() => {
      expect(onPrevious).toHaveBeenCalled();
    });
  });

  it('should disable Next/Submit when isLoading is true', () => {
    renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
        isLoading={true}
      />
    );

    const nextButton = screen.getByText('Next') as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
  });

  it('should call onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    renderWithTheme(
      <FormModal
        open={true}
        onClose={onClose}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should respect size prop', () => {
    const { container: containerSmall } = renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
        size="small"
      />
    );

    const { container: containerLarge } = renderWithTheme(
      <FormModal
        open={true}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        title="Form Modal"
        steps={mockSteps}
        size="large"
      />
    );

    expect(containerSmall.querySelector('.MuiDialog-root')).toBeInTheDocument();
    expect(containerLarge.querySelector('.MuiDialog-root')).toBeInTheDocument();
  });
});
