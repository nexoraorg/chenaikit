import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  LinearProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  Stack,
  Paper,
} from "@mui/material";
import { ExportFormat, ExportOptions } from "../utils/exportUtils";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, options: ExportOptions) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  defaultFormat?: ExportFormat;
}

type DateRangePreset =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "custom";

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  onExport,
  loading = false,
  error = null,
  defaultFormat = "csv",
}) => {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [dateRange, setDateRange] = useState<DateRangePreset>("month");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [filename, setFilename] = useState("dashboard-export");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const today = new Date();
    const from = new Date();

    switch (dateRange) {
      case "today":
        from.setHours(0, 0, 0, 0);
        break;
      case "week":
        from.setDate(today.getDate() - 7);
        break;
      case "month":
        from.setMonth(today.getMonth() - 1);
        break;
      case "quarter":
        from.setMonth(today.getMonth() - 3);
        break;
      case "year":
        from.setFullYear(today.getFullYear() - 1);
        break;
      case "custom":
        // Use custom dates
        return;
    }

    if (dateRange !== "custom") {
      setCustomFromDate(from.toISOString().split("T")[0]);
      setCustomToDate(today.toISOString().split("T")[0]);
    }
  }, [dateRange]);

  const getSelectedDateRange = () => {
    if (dateRange === "custom") {
      if (!customFromDate || !customToDate) {
        throw new Error(
          "Please select both start and end dates for custom date range",
        );
      }
      return {
        from: new Date(customFromDate),
        to: new Date(customToDate),
      };
    }

    const today = new Date();
    const from = new Date();

    switch (dateRange) {
      case "today":
        from.setHours(0, 0, 0, 0);
        break;
      case "week":
        from.setDate(today.getDate() - 7);
        break;
      case "month":
        from.setMonth(today.getMonth() - 1);
        break;
      case "quarter":
        from.setMonth(today.getMonth() - 3);
        break;
      case "year":
        from.setFullYear(today.getFullYear() - 1);
        break;
    }

    return { from, to: today };
  };

  const handleExport = async () => {
    try {
      setLocalError(null);
      setProgress(0);

      const dateRangeObj = getSelectedDateRange();

      const options: ExportOptions = {
        filename: filename || "dashboard-export",
        dateRange: dateRangeObj,
        metadata: includeMetadata
          ? {
              exportedBy: "Dashboard Export",
              exportType: format,
              includeMetadata: true,
            }
          : undefined,
      };

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 30;
        });
      }, 500);

      await onExport(format, options);

      clearInterval(progressInterval);
      setProgress(100);

      // Close the modal after a short delay
      setTimeout(() => {
        onClose();
        setProgress(0);
      }, 500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An error occurred during export";
      setLocalError(message);
      console.error("Export error:", err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Dashboard Data</DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Error Display */}
          {(error || localError) && (
            <Alert severity="error" onClose={() => setLocalError(null)}>
              {error || localError}
            </Alert>
          )}

          {/* Export Format */}
          <FormControl fullWidth>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={format}
              label="Export Format"
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              disabled={loading}
            >
              <MenuItem value="csv">CSV - Spreadsheet (.csv)</MenuItem>
              <MenuItem value="xlsx">
                Excel - Formatted Spreadsheet (.xlsx)
              </MenuItem>
              <MenuItem value="json">JSON - Developer Format (.json)</MenuItem>
              <MenuItem value="pdf">PDF - Report Format (.pdf)</MenuItem>
            </Select>
          </FormControl>

          {/* Date Range */}
          <FormControl fullWidth>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              label="Date Range"
              onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
              disabled={loading}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">Last 7 Days</MenuItem>
              <MenuItem value="month">Last 30 Days</MenuItem>
              <MenuItem value="quarter">Last 3 Months</MenuItem>
              <MenuItem value="year">Last Year</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </Select>
          </FormControl>

          {/* Custom Date Range */}
          {dateRange === "custom" && (
            <Box
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}
            >
              <TextField
                label="From Date"
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="To Date"
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}

          {/* Filename */}
          <TextField
            label="Filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            disabled={loading}
            helperText="The file extension will be added automatically"
            fullWidth
          />

          {/* Options */}
          <Paper sx={{ p: 2, backgroundColor: "action.hover" }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              Export Options
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  disabled={loading}
                />
              }
              label="Include metadata (export date, filters, etc.)"
            />
          </Paper>

          {/* Progress Indicator */}
          {loading && progress > 0 && (
            <Box>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <Typography variant="caption" sx={{ flex: 1 }}>
                  Exporting... {Math.round(progress)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(progress, 100)}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={loading}
          sx={{ minWidth: 120 }}
        >
          {loading ? "Exporting..." : "Export"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportModal;
