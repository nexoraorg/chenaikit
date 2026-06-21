import React, { useState } from "react";
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Description as CsvIcon,
  Code as JsonIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
} from "@mui/icons-material";

export interface ExportButtonProps {
  onExport: (format: "csv" | "json" | "pdf" | "excel") => void | Promise<void>;
  disabled?: boolean;
  variant?: "text" | "outlined" | "contained";
  size?: "small" | "medium" | "large";
  formats?: Array<"csv" | "json" | "pdf" | "excel">;
  loading?: boolean;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  disabled = false,
  variant = "contained",
  size = "medium",
  formats = ["csv", "json", "pdf", "excel"],
  loading = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: "csv" | "json" | "pdf" | "excel") => {
    setIsExporting(true);
    handleClose();

    try {
      await onExport(format);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatConfig = {
    csv: {
      icon: <CsvIcon />,
      label: "Export as CSV",
      description: "Comma-separated values for spreadsheets",
    },
    json: {
      icon: <JsonIcon />,
      label: "Export as JSON",
      description: "JSON format for developers",
    },
    pdf: {
      icon: <PdfIcon />,
      label: "Export as PDF",
      description: "PDF report with charts and tables",
    },
    excel: {
      icon: <ExcelIcon />,
      label: "Export as Excel",
      description: "Excel workbook with formatting",
    },
  };

  const isDisabled = disabled || loading || isExporting;

  return (
    <>
      <Tooltip title={isDisabled ? "Export in progress..." : "Export data"}>
        <span>
          <Button
            variant={variant}
            size={size}
            startIcon={
              isExporting ? <CircularProgress size={20} /> : <DownloadIcon />
            }
            onClick={handleClick}
            disabled={isDisabled}
            aria-controls="export-menu"
            aria-haspopup="true"
          >
            Export
          </Button>
        </span>
      </Tooltip>

      <Menu
        id="export-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
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
        {formats.map((format) => {
          const config = formatConfig[format];
          return (
            <MenuItem key={format} onClick={() => handleExport(format)}>
              <ListItemIcon>{config.icon}</ListItemIcon>
              <ListItemText
                primary={config.label}
                secondary={config.description}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

export default ExportButton;
