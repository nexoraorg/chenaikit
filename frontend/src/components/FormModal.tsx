import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  LinearProgress,
  FormHelperText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import FocusTrap from 'focus-trap-react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export interface FormStep {
  label: string;
  component: React.ReactNode;
  validation?: () => boolean;
  onNext?: () => void | Promise<void>;
  onPrevious?: () => void | Promise<void>;
}

interface FormModalProps {
  open: boolean;
  title: string;
  steps: FormStep[];
  onSubmit: (data?: any) => void | Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  showProgress?: boolean;
  disableBackdropClick?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const FormModal: React.FC<FormModalProps> = ({
  open,
  title,
  steps,
  onSubmit,
  onClose,
  isLoading = false,
  showProgress = true,
  disableBackdropClick = false,
  size = 'medium',
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const theme = useTheme();

  const isLastStep = activeStep === steps.length - 1;
  const isFirstStep = activeStep === 0;
  const currentStep = steps[activeStep];
  const hasError = errors[activeStep];

  const handleValidation = (): boolean => {
    if (currentStep.validation) {
      const isValid = currentStep.validation();
      if (!isValid) {
        setErrors((prev) => ({
          ...prev,
          [activeStep]: 'Please complete all required fields',
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          [activeStep]: '',
        }));
      }
      return isValid;
    }
    return true;
  };

  const handleNext = async () => {
    if (!handleValidation()) {
      return;
    }

    if (currentStep.onNext) {
      await currentStep.onNext();
    }

    if (isLastStep) {
      await onSubmit();
      setActiveStep(0);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handlePrevious = async () => {
    if (currentStep.onPrevious) {
      await currentStep.onPrevious();
    }
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  const handleBackdropClick = () => {
    if (!disableBackdropClick) {
      onClose();
    }
  };

  const sizeMap = {
    small: '500px',
    medium: '700px',
    large: '900px',
  };

  return (
    <FocusTrap active={open} focusTrapOptions={{ initialFocus: false }}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        onBackdropClick={handleBackdropClick}
        TransitionProps={{
          timeout: {
            enter: 300,
            exit: 200,
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: sizeMap[size],
          },
        }}
        aria-labelledby="form-modal-title"
      >
        <DialogTitle id="form-modal-title" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
          {title}
        </DialogTitle>

        {showProgress && (
          <Box sx={{ px: 3, pt: 2 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
              {steps.map((step, index) => (
                <Step key={index} completed={index < activeStep}>
                  <StepLabel>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            <LinearProgress
              variant="determinate"
              value={((activeStep + 1) / steps.length) * 100}
              sx={{ height: 4, borderRadius: 2 }}
            />
          </Box>
        )}

        <DialogContent
          sx={{
            py: 3,
            px: 3,
            minHeight: '250px',
          }}
        >
          <Box key={activeStep} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
              {currentStep.label}
            </Typography>
            {currentStep.component}
          </Box>

          {hasError && (
            <FormHelperText error sx={{ mt: 2 }}>
              {hasError}
            </FormHelperText>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            gap: 1,
          }}
        >
          <Button
            onClick={onClose}
            variant="outlined"
            disabled={isLoading}
            sx={{
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>

          {!isFirstStep && (
            <Button
              onClick={handlePrevious}
              startIcon={<ArrowBackIcon />}
              disabled={isLoading}
              sx={{
                textTransform: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            >
              Previous
            </Button>
          )}

          <Box sx={{ flex: 1 }} />

          <Button
            onClick={handleNext}
            variant="contained"
            color="primary"
            endIcon={isLastStep ? undefined : <ArrowForwardIcon />}
            disabled={isLoading || hasError}
            sx={{
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              minWidth: '120px',
            }}
          >
            {isLastStep ? 'Submit' : 'Next'}
          </Button>
        </DialogActions>
      </Dialog>
    </FocusTrap>
  );
};

export default FormModal;
export type { FormStep };
