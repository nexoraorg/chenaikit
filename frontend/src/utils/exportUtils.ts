import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { parse } from "papaparse";
import html2canvas from "html2canvas";

// Types for export data
export interface ExportMetadata {
  exportDate: Date;
  dateRange?: { start: Date; end: Date };
  filters?: Record<string, any>;
  source: string;
}

export interface ExportOptions {
  filename?: string;
  metadata?: ExportMetadata;
  includeCharts?: boolean;
  onProgress?: (progress: number) => void;
}

export interface ChartElement {
  element: HTMLElement;
  title: string;
}

// Utility to generate timestamp-based filename
export const generateFilename = (
  baseName: string,
  extension: string,
  metadata?: ExportMetadata,
): string => {
  const timestamp = new Date().toISOString().split("T")[0];
  const timeString = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
  return `${baseName}_${timestamp}_${timeString}.${extension}`;
};

// Utility to format metadata for export
export const formatMetadata = (
  metadata?: ExportMetadata,
): Record<string, string> => {
  if (!metadata) return {};

  const formatted: Record<string, string> = {
    "Export Date": metadata.exportDate.toLocaleString(),
    Source: metadata.source,
  };

  if (metadata.dateRange) {
    formatted["Date Range Start"] =
      metadata.dateRange.start.toLocaleDateString();
    formatted["Date Range End"] = metadata.dateRange.end.toLocaleDateString();
  }

  if (metadata.filters && Object.keys(metadata.filters).length > 0) {
    formatted["Filters Applied"] = JSON.stringify(metadata.filters, null, 2);
  }

  return formatted;
};

// CSV Export
export const exportToCSV = (
  data: Record<string, any>[],
  options: ExportOptions = {},
): void => {
  const { filename, metadata, onProgress } = options;

  try {
    onProgress?.(10);

    // Add metadata rows if provided
    let csvContent = "";
    if (metadata) {
      const metadataFormatted = formatMetadata(metadata);
      csvContent += "# Metadata\n";
      Object.entries(metadataFormatted).forEach(([key, value]) => {
        csvContent += `# ${key}: ${value}\n`;
      });
      csvContent += "\n";
    }

    onProgress?.(30);

    // Convert data to CSV
    if (data.length === 0) {
      throw new Error("No data to export");
    }

    // Get headers
    const headers = Object.keys(data[0]);
    csvContent += headers.join(",") + "\n";

    onProgress?.(50);

    // Add data rows
    data.forEach((row, index) => {
      const values = headers.map((header) => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? "";
      });
      csvContent += values.join(",") + "\n";

      if (index % 100 === 0) {
        onProgress?.(50 + (index / data.length) * 40);
      }
    });

    onProgress?.(90);

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename || generateFilename("export", "csv", metadata),
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onProgress?.(100);
  } catch (error) {
    console.error("CSV export failed:", error);
    throw error;
  }
};

// JSON Export
export const exportToJSON = (data: any, options: ExportOptions = {}): void => {
  const { filename, metadata, onProgress } = options;

  try {
    onProgress?.(20);

    const exportData = {
      metadata: metadata ? formatMetadata(metadata) : undefined,
      data,
      exportedAt: new Date().toISOString(),
    };

    onProgress?.(60);

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    onProgress?.(80);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename || generateFilename("export", "json", metadata),
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onProgress?.(100);
  } catch (error) {
    console.error("JSON export failed:", error);
    throw error;
  }
};

// Excel Export
export const exportToExcel = (
  data: Record<string, any>[],
  options: ExportOptions & { sheetName?: string } = {},
): void => {
  const { filename, metadata, sheetName = "Sheet1", onProgress } = options;

  try {
    onProgress?.(10);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Add metadata sheet if provided
    if (metadata) {
      const metadataFormatted = formatMetadata(metadata);
      const metadataArray = Object.entries(metadataFormatted).map(
        ([key, value]) => ({ Field: key, Value: value }),
      );
      const metadataSheet = XLSX.utils.json_to_sheet(metadataArray);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, "Metadata");
    }

    onProgress?.(40);

    // Add data sheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const columnWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...data.map((row) => String(row[key] || "").length),
      ),
    }));
    worksheet["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    onProgress?.(70);

    // Generate file
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    onProgress?.(90);

    // Download file
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename || generateFilename("export", "xlsx", metadata),
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onProgress?.(100);
  } catch (error) {
    console.error("Excel export failed:", error);
    throw error;
  }
};

// PDF Export with charts
export const exportToPDF = async (
  data: Record<string, any>[],
  charts: ChartElement[] = [],
  options: ExportOptions = {},
): Promise<void> => {
  const { filename, metadata, onProgress } = options;

  try {
    onProgress?.(5);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    onProgress?.(10);

    // Add title
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Dashboard Export Report", margin, yPosition);
    yPosition += 10;

    // Add metadata
    if (metadata) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const metadataFormatted = formatMetadata(metadata);
      Object.entries(metadataFormatted).forEach(([key, value]) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(`${key}: ${value}`, margin, yPosition);
        yPosition += 5;
      });
      yPosition += 5;
    }

    onProgress?.(20);

    // Add charts if provided
    if (charts.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text("Charts and Visualizations", margin, yPosition);
      yPosition += 10;

      for (let i = 0; i < charts.length; i++) {
        const { element, title } = charts[i];
        onProgress?.(20 + ((i + 1) / charts.length) * 40);

        try {
          // Capture chart as image
          const canvas = await html2canvas(element, {
            backgroundColor: "#ffffff",
            scale: 2,
            logging: false,
          });

          const imgData = canvas.toDataURL("image/png");
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Check if we need a new page
          if (yPosition + imgHeight + 20 > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          // Add chart title
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text(title, margin, yPosition);
          yPosition += 7;

          // Add chart image
          pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        } catch (chartError) {
          console.error(`Failed to capture chart: ${title}`, chartError);
        }
      }
    }

    onProgress?.(70);

    // Add data table
    if (data.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      if (yPosition > pageHeight - margin - 20) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text("Data Summary", margin, yPosition);
      yPosition += 10;

      // Table configuration
      const headers = Object.keys(data[0]);
      const colWidth = (pageWidth - 2 * margin) / headers.length;
      const rowHeight = 7;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      // Draw headers
      if (yPosition + rowHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      headers.forEach((header, index) => {
        pdf.text(header, margin + index * colWidth, yPosition, {
          maxWidth: colWidth - 2,
        });
      });
      yPosition += rowHeight;

      pdf.setFont("helvetica", "normal");

      // Draw data rows (limit to prevent huge PDFs)
      const maxRows = 50;
      const rowsToShow = data.slice(0, maxRows);

      rowsToShow.forEach((row, rowIndex) => {
        if (yPosition + rowHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;

          // Redraw headers on new page
          pdf.setFont("helvetica", "bold");
          headers.forEach((header, index) => {
            pdf.text(header, margin + index * colWidth, yPosition, {
              maxWidth: colWidth - 2,
            });
          });
          yPosition += rowHeight;
          pdf.setFont("helvetica", "normal");
        }

        headers.forEach((header, colIndex) => {
          const value = String(row[header] ?? "");
          pdf.text(
            value.substring(0, 30), // Truncate long values
            margin + colIndex * colWidth,
            yPosition,
            { maxWidth: colWidth - 2 },
          );
        });
        yPosition += rowHeight;

        onProgress?.(70 + ((rowIndex + 1) / rowsToShow.length) * 20);
      });

      if (data.length > maxRows) {
        yPosition += 5;
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Note: Only showing first ${maxRows} of ${data.length} rows. Export to CSV or Excel for full data.`,
          margin,
          yPosition,
        );
      }
    }

    onProgress?.(95);

    // Save PDF
    pdf.save(filename || generateFilename("export", "pdf", metadata));

    onProgress?.(100);
  } catch (error) {
    console.error("PDF export failed:", error);
    throw error;
  }
};

// Batch export function
export const batchExport = async (
  datasets: Array<{
    name: string;
    data: Record<string, any>[];
    charts?: ChartElement[];
  }>,
  format: "csv" | "json" | "excel" | "pdf",
  options: ExportOptions = {},
): Promise<void> => {
  const { onProgress } = options;

  try {
    for (let i = 0; i < datasets.length; i++) {
      const { name, data, charts } = datasets[i];
      const progress = ((i + 1) / datasets.length) * 100;

      const datasetOptions = {
        ...options,
        filename: generateFilename(name, format, options.metadata),
        onProgress: (p: number) =>
          onProgress?.(((i + p / 100) / datasets.length) * 100),
      };

      switch (format) {
        case "csv":
          exportToCSV(data, datasetOptions);
          break;
        case "json":
          exportToJSON(data, datasetOptions);
          break;
        case "excel":
          exportToExcel(data, { ...datasetOptions, sheetName: name });
          break;
        case "pdf":
          await exportToPDF(data, charts || [], datasetOptions);
          break;
      }

      onProgress?.(progress);

      // Small delay between exports to prevent browser blocking
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error("Batch export failed:", error);
    throw error;
  }
};
