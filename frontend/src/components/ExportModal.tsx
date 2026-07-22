import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Box,
  Typography,
  LinearProgress,
  Alert,
  Checkbox,
  FormGroup,
  Divider,
  Chip,
} from "@mui/material";
import {
  Close as CloseIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { DateRangePicker } from "./DateRangePicker";

export interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (config: ExportConfig) => Promise<void>;
  title?: string;
  availableDatasets?: string[];
}

export interface ExportConfig {
  format: "csv" | "json" | "pdf" | "excel";
  filename?: string;
  includeCharts: boolean;
  includeMetadata: boolean;
  dateRange?: { start: Date; end: Date };
  datasets: string[];
  filters?: Record<string, any>;
}

const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  onExport,
  title = "Export Dashboard Data",
  availableDatasets = ["System Usage", "AI Performance", "Blockchain Activity"],
}) => {
  const [format, setFormat] = useState<"csv" | "json" | "pdf" | "excel">("csv");
  const [filename, setFilename] = useState("");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(
    null,
  );
  const [selectedDatasets, setSelectedDatasets] =
    useState<string[]>(availableDatasets);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDatasetToggle = (dataset: string) => {
    setSelectedDatasets((prev) =>
      prev.includes(dataset)
        ? prev.filter((d) => d !== dataset)
        : [...prev, dataset],
    );
  };

  const handleExport = async () => {
    if (selectedDatasets.length === 0) {
      setError("Please select at least one dataset to export");
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setError(null);

    const config: ExportConfig = {
      format,
      filename: filename || undefined,
      includeCharts: format === "pdf" ? includeCharts : false,
      includeMetadata,
      dateRange: dateRange || undefined,
      datasets: selectedDatasets,
    };

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await onExport(config);

      clearInterval(progressInterval);
      setProgress(100);

      // Close modal after successful export
      setTimeout(() => {
        handleClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Export failed. Please try again.");
      setProgress(0);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setFormat("csv");
      setFilename("");
      setIncludeCharts(true);
      setIncludeMetadata(true);
      setDateRange(null);
      setSelectedDatasets(availableDatasets);
      setProgress(0);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="export-dialog-title"
    >
      <DialogTitle id="export-dialog-title">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <Button
            onClick={handleClose}
            disabled={isExporting}
            size="small"
            sx={{ minWidth: "auto" }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Format Selection */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend">Export Format</FormLabel>
          <RadioGroup
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as "csv" | "json" | "pdf" | "excel")
            }
          >
            <FormControlLabel
              value="csv"
              control={<Radio />}
              label="CSV - Comma-separated values for spreadsheets"
              disabled={isExporting}
            />
            <FormControlLabel
              value="json"
              control={<Radio />}
              label="JSON - Data format for developers"
              disabled={isExporting}
            />
            <FormControlLabel
              value="pdf"
              control={<Radio />}
              label="PDF - Report with charts and tables"
              disabled={isExporting}
            />
            <FormControlLabel
              value="excel"
              control={<Radio />}
              label="Excel - Formatted workbook with sheets"
              disabled={isExporting}
            />
          </RadioGroup>
        </FormControl>

        <Divider sx={{ my: 2 }} />

        {/* Filename */}
        <TextField
          fullWidth
          label="Filename (optional)"
          placeholder="Leave empty for auto-generated name"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          disabled={isExporting}
          sx={{ mb: 3 }}
          helperText="File extension will be added automatically"
        />

        {/* Dataset Selection */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend">Select Datasets to Export</FormLabel>
          <FormGroup>
            {availableDatasets.map((dataset) => (
              <FormControlLabel
                key={dataset}
                control={
                  <Checkbox
                    checked={selectedDatasets.includes(dataset)}
                    onChange={() => handleDatasetToggle(dataset)}
                    disabled={isExporting}
                  />
                }
                label={dataset}
              />
            ))}
          </FormGroup>
        </FormControl>

        <Divider sx={{ my: 2 }} />

        {/* Date Range */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            Date Range (optional)
          </FormLabel>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            disabled={isExporting}
          />
          {dateRange && (
            <Box sx={{ mt: 1 }}>
              <Chip
                label={`${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`}
                onDelete={() => setDateRange(null)}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Additional Options */}
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend">Additional Options</FormLabel>
          <FormGroup>
            {format === "pdf" && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    disabled={isExporting}
                  />
                }
                label="Include charts and visualizations"
              />
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  disabled={isExporting}
                />
              }
              label="Include export metadata (date, filters, etc.)"
            />
          </FormGroup>
        </FormControl>

        {/* Progress Bar */}
        {isExporting && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Exporting... {progress}%
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<DownloadIcon />}
          disabled={isExporting || selectedDatasets.length === 0}
        >
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportModal;
