import React, { useState } from "react";
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Tooltip,
  Box,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Description as DescriptionIcon,
  Code as CodeIcon,
  TableChart as TableChartIcon,
  PictureAsPdf as PictureAsPdfIcon,
} from "@mui/icons-material";
import { ExportFormat } from "../utils/exportUtils";

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
  variant?: "text" | "outlined" | "contained";
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  disabled = false,
  variant = "outlined",
  size = "medium",
  showLabel = true,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      setExporting(true);
      setActiveFormat(format);
      await onExport(format);
      handleClose();
    } catch (error) {
      console.error(`Failed to export as ${format}:`, error);
    } finally {
      setExporting(false);
      setActiveFormat(null);
    }
  };

  const exportOptions = [
    {
      format: "csv" as ExportFormat,
      label: "CSV (.csv)",
      icon: <TableChartIcon fontSize="small" />,
      description: "Spreadsheet format",
    },
    {
      format: "json" as ExportFormat,
      label: "JSON (.json)",
      icon: <CodeIcon fontSize="small" />,
      description: "Developer format",
    },
    {
      format: "xlsx" as ExportFormat,
      label: "Excel (.xlsx)",
      icon: <TableChartIcon fontSize="small" />,
      description: "Formatted spreadsheet",
    },
    {
      format: "pdf" as ExportFormat,
      label: "PDF (.pdf)",
      icon: <PictureAsPdfIcon fontSize="small" />,
      description: "Report format",
    },
  ];

  return (
    <Box sx={{ display: "inline-block" }}>
      <Tooltip title={disabled ? "No data to export" : "Export dashboard data"}>
        <span>
          <Button
            id="export-button"
            aria-controls={open ? "export-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            onClick={handleClick}
            disabled={disabled || exporting}
            startIcon={
              exporting ? <CircularProgress size={20} /> : <DownloadIcon />
            }
            variant={variant}
            size={size}
          >
            {showLabel && (exporting ? "Exporting..." : "Export")}
          </Button>
        </span>
      </Tooltip>

      <Menu
        id="export-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {exportOptions.map((option) => (
          <MenuItem
            key={option.format}
            onClick={() => handleExport(option.format)}
            disabled={exporting && activeFormat !== option.format}
          >
            <ListItemIcon>
              {exporting && activeFormat === option.format ? (
                <CircularProgress size={20} />
              ) : (
                option.icon
              )}
            </ListItemIcon>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <ListItemText primary={option.label} />
              <ListItemText
                secondary={option.description}
                sx={{ fontSize: "0.75rem", color: "text.secondary" }}
              />
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default ExportButton;
