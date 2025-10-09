import { ExportOptions, TransactionData, PerformanceMetrics, UserActivity, NetworkNode, NetworkLink } from '../types/visualization';
import { generateCSV, downloadFile } from './chart-helpers';

// Export chart as PNG
export async function exportChartAsPNG(
  element: HTMLElement,
  options: ExportOptions
): Promise<void> {
  const { filename, quality = 0.9, backgroundColor = '#FFFFFF' } = options;
  
  try {
    // Use html2canvas to capture the element
    const html2canvas = (await import('html2canvas')).default;
    
    const canvas = await html2canvas(element, {
      backgroundColor,
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      logging: false
    });

    // Convert to PNG
    const dataURL = canvas.toDataURL('image/png', quality);
    
    // Create download link
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting PNG:', error);
    throw new Error('Failed to export chart as PNG');
  }
}

// Export chart as SVG
export async function exportChartAsSVG(
  svgElement: SVGSVGElement,
  options: ExportOptions
): Promise<void> {
  const { filename } = options;
  
  try {
    // Clone the SVG element
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Remove any filters or effects that might not render properly
    const filters = clonedSvg.querySelectorAll('filter');
    filters.forEach(filter => filter.remove());
    
    // Get SVG content
    const svgContent = new XMLSerializer().serializeToString(clonedSvg);
    
    // Create blob and download
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${filename}.svg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting SVG:', error);
    throw new Error('Failed to export chart as SVG');
  }
}

// Export data as CSV
export function exportDataAsCSV(
  data: any[],
  options: ExportOptions
): void {
  const { filename } = options;
  
  try {
    if (data.length === 0) {
      throw new Error('No data to export');
    }
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Generate CSV content
    const csvContent = generateCSV(data, headers);
    
    // Download file
    downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw new Error('Failed to export data as CSV');
  }
}

// Export data as PDF
export async function exportDataAsPDF(
  data: any[],
  options: ExportOptions
): Promise<void> {
  const { filename, backgroundColor = '#FFFFFF' } = options;
  
  try {
    const jsPDF = (await import('jspdf')).default;
    const pdf = new jsPDF();
    
    // Set background color
    pdf.setFillColor(backgroundColor);
    pdf.rect(0, 0, pdf.internal.pageSize.width, pdf.internal.pageSize.height, 'F');
    
    // Add title
    pdf.setFontSize(16);
    pdf.text('Data Export', 20, 20);
    
    // Add data table
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const tableData = data.map(row => 
        headers.map(header => String(row[header] || ''))
      );
      
      // Simple table implementation
      let y = 40;
      const lineHeight = 7;
      const maxWidth = pdf.internal.pageSize.width - 40;
      
      // Headers
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      headers.forEach((header, index) => {
        const x = 20 + (index * (maxWidth / headers.length));
        pdf.text(header, x, y);
      });
      
      y += lineHeight;
      
      // Data rows
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      
      data.slice(0, 20).forEach((row, rowIndex) => { // Limit to 20 rows
        if (y > pdf.internal.pageSize.height - 20) {
          pdf.addPage();
          y = 20;
        }
        
        headers.forEach((header, colIndex) => {
          const x = 20 + (colIndex * (maxWidth / headers.length));
          const value = String(row[header] || '');
          pdf.text(value.length > 20 ? value.substring(0, 20) + '...' : value, x, y);
        });
        
        y += lineHeight;
      });
    }
    
    // Save PDF
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('Failed to export data as PDF');
  }
}

// Export transaction data with specific formatting
export function exportTransactionData(
  data: TransactionData[],
  options: ExportOptions
): void {
  const { filename } = options;
  
  const formattedData = data.map(transaction => ({
    'Transaction ID': transaction.id,
    'From': transaction.from,
    'To': transaction.to,
    'Amount': transaction.amount,
    'Asset': transaction.asset,
    'Type': transaction.type,
    'Status': transaction.status,
    'Fee': transaction.fee,
    'Timestamp': transaction.timestamp.toISOString(),
    'Memo': transaction.memo || ''
  }));
  
  exportDataAsCSV(formattedData, options);
}

// Export performance metrics data
export function exportPerformanceData(
  data: PerformanceMetrics[],
  options: ExportOptions
): void {
  const { filename } = options;
  
  const formattedData = data.map(metric => ({
    'Model Name': metric.modelName,
    'Accuracy': (metric.accuracy * 100).toFixed(2) + '%',
    'Precision': (metric.precision * 100).toFixed(2) + '%',
    'Recall': (metric.recall * 100).toFixed(2) + '%',
    'F1 Score': (metric.f1Score * 100).toFixed(2) + '%',
    'Dataset': metric.dataset,
    'Version': metric.version,
    'Timestamp': metric.timestamp.toISOString()
  }));
  
  exportDataAsCSV(formattedData, options);
}

// Export user activity data
export function exportUserActivityData(
  data: UserActivity[],
  options: ExportOptions
): void {
  const { filename } = options;
  
  const formattedData = data.map(activity => ({
    'User ID': activity.userId,
    'Action': activity.action,
    'Value': activity.value,
    'Category': activity.category,
    'Location': activity.location || '',
    'Timestamp': activity.timestamp.toISOString()
  }));
  
  exportDataAsCSV(formattedData, options);
}

// Export network data
export function exportNetworkData(
  nodes: NetworkNode[],
  links: NetworkLink[],
  options: ExportOptions
): void {
  const { filename } = options;
  
  // Export nodes
  const nodeData = nodes.map(node => ({
    'Node ID': node.id,
    'Label': node.label,
    'Type': node.type,
    'Connections': node.connections,
    'Value': node.value,
    'X Position': node.position.x,
    'Y Position': node.position.y
  }));
  
  // Export links
  const linkData = links.map(link => ({
    'Source': link.source,
    'Target': link.target,
    'Weight': link.weight,
    'Type': link.type,
    'Timestamp': link.timestamp.toISOString()
  }));
  
  // Create combined data
  const combinedData = [
    ...nodeData.map(node => ({ ...node, 'Data Type': 'Node' })),
    ...linkData.map(link => ({ ...link, 'Data Type': 'Link' }))
  ];
  
  exportDataAsCSV(combinedData, options);
}

// Generic export function
export async function exportVisualization(
  element: HTMLElement,
  data: any[],
  format: 'png' | 'svg' | 'csv' | 'pdf',
  filename: string,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  const exportOptions: ExportOptions = {
    format,
    filename,
    ...options
  };
  
  switch (format) {
    case 'png':
      await exportChartAsPNG(element, exportOptions);
      break;
    case 'svg':
      const svgElement = element.querySelector('svg');
      if (!svgElement) {
        throw new Error('No SVG element found for export');
      }
      await exportChartAsSVG(svgElement, exportOptions);
      break;
    case 'csv':
      exportDataAsCSV(data, exportOptions);
      break;
    case 'pdf':
      await exportDataAsPDF(data, exportOptions);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// Export multiple formats at once
export async function exportMultipleFormats(
  element: HTMLElement,
  data: any[],
  formats: ('png' | 'svg' | 'csv' | 'pdf')[],
  baseFilename: string,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  const exportPromises = formats.map(format => 
    exportVisualization(element, data, format, baseFilename, options)
  );
  
  try {
    await Promise.all(exportPromises);
  } catch (error) {
    console.error('Error exporting multiple formats:', error);
    throw new Error('Failed to export some formats');
  }
}
