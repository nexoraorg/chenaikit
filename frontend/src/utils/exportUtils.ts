import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

/**
 * Export format types supported by the application
 */
export type ExportFormat = "csv" | "json" | "pdf" | "xlsx";

/**
 * Options for exporting data
 */
export interface ExportOptions {
  filename?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Progress callback for tracking export progress
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * Convert array of objects to CSV format
 * @param data - Array of objects to export
 * @param filename - Name of the file to download
 */
export function exportToCSV(
  data: any[],
  filename: string = "export.csv",
  onProgress?: ProgressCallback,
): void {
  try {
    onProgress?.(10, "Preparing CSV data...");

    if (!Array.isArray(data) || data.length === 0) {
      console.warn("No data to export to CSV");
      return;
    }

    // Get all unique keys from all objects
    const keys = Array.from(new Set(data.flatMap((obj) => Object.keys(obj))));

    onProgress?.(30, "Converting data to CSV format...");

    // Create CSV header
    const header = keys.join(",");

    // Create CSV rows
    const rows = data.map((obj) =>
      keys
        .map((key) => {
          const value = obj[key];
          // Handle commas, quotes, and newlines in values
          if (
            typeof value === "string" &&
            (value.includes(",") || value.includes('"') || value.includes("\n"))
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value ?? "");
        })
        .join(","),
    );

    const csv = [header, ...rows].join("\n");

    onProgress?.(70, "Creating download...");

    // Download the CSV file
    downloadFile(csv, filename, "text/csv");

    onProgress?.(100, "CSV export completed successfully");
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    throw new Error(
      `Failed to export to CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Convert array of objects to JSON format
 * @param data - Array of objects to export
 * @param filename - Name of the file to download
 * @param options - Export options including metadata
 */
export function exportToJSON(
  data: any[],
  filename: string = "export.json",
  options?: ExportOptions,
  onProgress?: ProgressCallback,
): void {
  try {
    onProgress?.(10, "Preparing JSON data...");

    if (!Array.isArray(data) || data.length === 0) {
      console.warn("No data to export to JSON");
      return;
    }

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        recordCount: data.length,
        ...(options?.dateRange && {
          dateRange: {
            from: options.dateRange.from.toISOString(),
            to: options.dateRange.to.toISOString(),
          },
        }),
        ...(options?.filters && { filters: options.filters }),
        ...options?.metadata,
      },
      data,
    };

    onProgress?.(50, "Converting to JSON format...");

    const json = JSON.stringify(exportData, null, 2);

    onProgress?.(70, "Creating download...");

    downloadFile(json, filename, "application/json");

    onProgress?.(100, "JSON export completed successfully");
  } catch (error) {
    console.error("Error exporting to JSON:", error);
    throw new Error(
      `Failed to export to JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Export data to Excel (XLSX) format
 * @param data - Array of objects to export
 * @param filename - Name of the file to download
 * @param sheetName - Name of the sheet in the workbook
 */
export function exportToXLSX(
  data: any[],
  filename: string = "export.xlsx",
  sheetName: string = "Sheet1",
  onProgress?: ProgressCallback,
): void {
  try {
    onProgress?.(10, "Preparing Excel data...");

    if (!Array.isArray(data) || data.length === 0) {
      console.warn("No data to export to XLSX");
      return;
    }

    onProgress?.(30, "Creating workbook...");

    // Create a new workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    onProgress?.(70, "Formatting spreadsheet...");

    // Auto-fit column widths
    const maxWidths = Object.keys(data[0] || {}).map((key) => {
      const values = [key, ...data.map((row) => String(row[key] ?? ""))];
      return Math.min(Math.max(...values.map((v) => v.length)), 50);
    });

    worksheet["!cols"] = maxWidths.map((width) => ({ wch: width }));

    onProgress?.(90, "Creating download...");

    XLSX.writeFile(workbook, filename);

    onProgress?.(100, "Excel export completed successfully");
  } catch (error) {
    console.error("Error exporting to XLSX:", error);
    throw new Error(
      `Failed to export to XLSX: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Export a React element (including charts) to PDF
 * @param elementId - ID of the HTML element to export
 * @param filename - Name of the PDF file
 * @param title - Title to appear in the PDF
 */
export async function exportToPDF(
  elementId: string,
  filename: string = "export.pdf",
  title: string = "",
  onProgress?: ProgressCallback,
): Promise<void> {
  try {
    onProgress?.(10, "Preparing PDF...");

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    onProgress?.(30, "Capturing dashboard content...");

    // Capture the element as a canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      allowTaint: true,
    });

    onProgress?.(60, "Generating PDF...");

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Calculate dimensions to fit the image
    const imgWidth = 280; // A4 landscape width in mm minus margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10; // Top margin

    // Add title if provided
    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, 15, position);
      position += 15;
      heightLeft -= 15;
    }

    // Add export date
    pdf.setFontSize(10);
    pdf.text(`Exported: ${new Date().toLocaleString()}`, 15, position + 5);
    position += 10;
    heightLeft -= 10;

    // Add the image, with multiple pages if necessary
    while (heightLeft > 0) {
      const pageHeight = 190; // Usable height per page in mm
      if (heightLeft <= pageHeight) {
        pdf.addImage(imgData, "PNG", 15, position, imgWidth, heightLeft);
        heightLeft = 0;
      } else {
        pdf.addImage(imgData, "PNG", 15, position, imgWidth, pageHeight);
        heightLeft -= pageHeight;
        position = 10;
        pdf.addPage();
      }
    }

    onProgress?.(90, "Finalizing PDF...");

    pdf.save(filename);

    onProgress?.(100, "PDF export completed successfully");
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw new Error(
      `Failed to export to PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Export dashboard data in the specified format
 * @param format - Export format (csv, json, pdf, xlsx)
 * @param data - Data to export (not needed for PDF)
 * @param options - Export options
 */
export async function exportDashboard(
  format: ExportFormat,
  data: any[],
  options: ExportOptions = {},
  onProgress?: ProgressCallback,
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const filename = options.filename || `dashboard-export-${timestamp}`;

  try {
    switch (format) {
      case "csv":
        exportToCSV(data, `${filename}.csv`, onProgress);
        break;
      case "json":
        exportToJSON(data, `${filename}.json`, options, onProgress);
        break;
      case "xlsx":
        exportToXLSX(data, `${filename}.xlsx`, "Dashboard Data", onProgress);
        break;
      case "pdf":
        // For PDF, we expect the element ID to be in options.metadata.elementId
        const elementId = options.metadata?.elementId || "dashboard-container";
        await exportToPDF(
          elementId,
          `${filename}.pdf`,
          options.metadata?.title,
          onProgress,
        );
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    console.error(`Error exporting dashboard as ${format}:`, error);
    throw error;
  }
}

/**
 * Helper function to download a file
 * @param content - File content
 * @param filename - Name of the file
 * @param mimeType - MIME type of the file
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Format date range for export filenames
 */
export function formatDateRangeForFilename(from?: Date, to?: Date): string {
  if (!from || !to) return "";
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];
  return `${fromStr}-to-${toStr}`;
}

/**
 * Filter data by date range
 */
export function filterDataByDateRange(
  data: any[],
  dateField: string,
  from: Date,
  to: Date,
): any[] {
  return data.filter((item) => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= from && itemDate <= to;
  });
}
