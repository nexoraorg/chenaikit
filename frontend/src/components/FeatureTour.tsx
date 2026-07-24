import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";

interface FeatureTourProps {
  open: boolean;
  onClose: () => void;
}

const tourSteps = [
  {
    title: "Welcome to ChenaiKit",
    content:
      "This quick tour will guide you through the main dashboard controls, reporting panels, and help resources.",
  },
  {
    title: "Dashboard Header",
    content:
      "The dashboard header gives you quick access to theme controls, help, and account settings.",
  },
  {
    title: "Time Range Selector",
    content: "Use this range selector to filter analytics and reports by time window.",
  },
  {
    title: "Export Actions",
    content: "Export charts, CSV files, and reports from the action bar here.",
  },
  {
    title: "Visualization Tabs",
    content:
      "Switch between data visualization modules and explore charts, heatmaps, and topology views.",
  },
  {
    title: "Tour Complete",
    content:
      "You are now familiar with the main features. Use the Help button anytime for more information.",
  },
];

const FeatureTour: React.FC<FeatureTourProps> = ({ open, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const step = tourSteps[currentStep];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{step.title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body1">{step.content}</Typography>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: "block" }}>
            Step {currentStep + 1} of {tourSteps.length}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSkip}>Skip</Button>
        <Button onClick={handleNext} variant="contained" color="primary">
          {currentStep === tourSteps.length - 1 ? "Finish" : "Next"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeatureTour;
