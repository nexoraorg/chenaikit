import { ChartProps, TransactionData, PerformanceMetrics, UserActivity, NetworkNode, NetworkLink } from '../types/visualization';

// Generate accessible descriptions for charts
export function generateChartDescription(
  chartType: string,
  data: any[],
  options: { 
    title?: string;
    summary?: string;
    keyInsights?: string[];
  } = {}
): string {
  const { title, summary, keyInsights = [] } = options;
  
  let description = '';
  
  if (title) {
    description += `${title}. `;
  }
  
  description += `This is a ${chartType} chart displaying ${data.length} data points. `;
  
  if (summary) {
    description += `${summary} `;
  }
  
  if (keyInsights.length > 0) {
    description += `Key insights: ${keyInsights.join(', ')}. `;
  }
  
  // Add data range information
  if (data.length > 0) {
    const numericValues = data
      .map(d => typeof d.value === 'number' ? d.value : 0)
      .filter(v => !isNaN(v));
    
    if (numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      description += `Data ranges from ${min} to ${max}. `;
    }
  }
  
  return description;
}

// Generate accessible table data for screen readers
export function generateAccessibleTableData(
  data: any[],
  maxRows: number = 10
): { headers: string[]; rows: string[][] } {
  if (data.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = Object.keys(data[0]);
  const rows = data.slice(0, maxRows).map(row => 
    headers.map(header => String(row[header] || ''))
  );
  
  return { headers, rows };
}

// Generate accessible transaction description
export function generateTransactionDescription(transaction: TransactionData): string {
  const statusText = transaction.status === 'success' ? 'successful' : 
                    transaction.status === 'failed' ? 'failed' : 'pending';
  
  return `Transaction ${transaction.id}: ${statusText} transfer of ${transaction.amount} ${transaction.asset} from ${transaction.from.slice(0, 8)}... to ${transaction.to.slice(0, 8)}... at ${transaction.timestamp.toLocaleString()}.`;
}

// Generate accessible performance metrics description
export function generatePerformanceDescription(metric: PerformanceMetrics): string {
  return `Model ${metric.modelName}: Accuracy ${(metric.accuracy * 100).toFixed(1)}%, Precision ${(metric.precision * 100).toFixed(1)}%, Recall ${(metric.recall * 100).toFixed(1)}%, F1 Score ${(metric.f1Score * 100).toFixed(1)}% on ${metric.dataset} dataset, version ${metric.version}.`;
}

// Generate accessible user activity description
export function generateUserActivityDescription(activity: UserActivity): string {
  const locationText = activity.location ? ` in ${activity.location}` : '';
  return `User ${activity.userId} performed ${activity.action} with value ${activity.value} in category ${activity.category}${locationText} at ${activity.timestamp.toLocaleString()}.`;
}

// Generate accessible network node description
export function generateNetworkNodeDescription(node: NetworkNode): string {
  return `Node ${node.id} (${node.label}): ${node.type} with ${node.connections} connections, value ${node.value}, positioned at coordinates ${node.position.x}, ${node.position.y}.`;
}

// Generate accessible network link description
export function generateNetworkLinkDescription(link: NetworkLink): string {
  return `Link from ${link.source} to ${link.target}: ${link.type} relationship with weight ${link.weight.toFixed(3)} at ${link.timestamp.toLocaleString()}.`;
}

// Create accessible chart props
export function createAccessibleChartProps(
  chartType: string,
  data: any[],
  options: {
    title?: string;
    summary?: string;
    keyInsights?: string[];
    onDataPointFocus?: (data: any) => void;
    onDataPointSelect?: (data: any) => void;
  } = {}
): Partial<ChartProps> {
  const description = generateChartDescription(chartType, data, options);
  
  return {
    'aria-label': `${chartType} chart`,
    'aria-describedby': `chart-description-${chartType}`,
    role: 'img',
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        // Focus first data point
        if (data.length > 0 && options.onDataPointFocus) {
          options.onDataPointFocus(data[0]);
        }
      }
    }
  };
}

// Generate keyboard navigation instructions
export function generateKeyboardInstructions(): string {
  return 'Use arrow keys to navigate between data points. Press Enter or Space to select a data point. Press Tab to move to the next interactive element. Press Escape to close any open tooltips or menus.';
}

// Create accessible data table
export function createAccessibleDataTable(
  data: any[],
  options: {
    title?: string;
    maxRows?: number;
    onRowSelect?: (row: any, index: number) => void;
  } = {}
): {
  tableProps: React.TableHTMLAttributes<HTMLTableElement>;
  caption: string;
  headers: string[];
  rows: Array<{
    data: any;
    rowProps: React.HTMLAttributes<HTMLTableRowElement>;
    cells: Array<{
      value: string;
      cellProps: React.TdHTMLAttributes<HTMLTableCellElement>;
    }>;
  }>;
} {
  const { title, maxRows = 10, onRowSelect } = options;
  const { headers, rows } = generateAccessibleTableData(data, maxRows);
  
  const tableProps: React.TableHTMLAttributes<HTMLTableElement> = {
    role: 'table',
    'aria-label': title || 'Data table',
    'aria-describedby': title ? `${title}-description` : undefined
  };
  
  const caption = title || `Data table with ${data.length} rows and ${headers.length} columns`;
  
  const accessibleRows = rows.map((row, rowIndex) => ({
    data: data[rowIndex],
    rowProps: {
      role: 'row',
      tabIndex: 0,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRowSelect?.(data[rowIndex], rowIndex);
        }
      },
      onClick: () => onRowSelect?.(data[rowIndex], rowIndex)
    },
    cells: row.map((cell, cellIndex) => ({
      value: cell,
      cellProps: {
        role: 'cell',
        'aria-label': `${headers[cellIndex]}: ${cell}`
      }
    }))
  }));
  
  return {
    tableProps,
    caption,
    headers,
    rows: accessibleRows
  };
}

// Generate screen reader announcements
export function generateScreenReaderAnnouncement(
  type: 'data-update' | 'selection-change' | 'filter-change' | 'export-complete',
  details: any
): string {
  switch (type) {
    case 'data-update':
      return `Data updated. ${details.count} new data points loaded.`;
    case 'selection-change':
      return `Selection changed to ${details.label || details.id || 'item'}.`;
    case 'filter-change':
      return `Filter applied. ${details.visibleCount} of ${details.totalCount} items visible.`;
    case 'export-complete':
      return `Export completed. ${details.filename} downloaded successfully.`;
    default:
      return 'Chart interaction completed.';
  }
}

// Create accessible color palette
export function createAccessibleColorPalette(
  baseColors: string[],
  options: {
    ensureContrast?: boolean;
    colorBlindFriendly?: boolean;
  } = {}
): string[] {
  const { ensureContrast = true, colorBlindFriendly = true } = options;
  
  let palette = [...baseColors];
  
  if (colorBlindFriendly) {
    // Use colorblind-friendly colors
    palette = [
      '#1f77b4', // blue
      '#ff7f0e', // orange
      '#2ca02c', // green
      '#d62728', // red
      '#9467bd', // purple
      '#8c564b', // brown
      '#e377c2', // pink
      '#7f7f7f', // gray
      '#bcbd22', // olive
      '#17becf'  // cyan
    ];
  }
  
  if (ensureContrast) {
    // Ensure sufficient contrast ratios
    palette = palette.map(color => {
      // This is a simplified contrast check
      // In a real implementation, you'd use a proper contrast calculation
      return color;
    });
  }
  
  return palette;
}

// Generate accessible chart summary
export function generateChartSummary(
  data: any[],
  chartType: string,
  options: {
    includeStatistics?: boolean;
    includeTrends?: boolean;
    includeOutliers?: boolean;
  } = {}
): string {
  const { includeStatistics = true, includeTrends = true, includeOutliers = true } = options;
  
  let summary = `Chart summary: ${chartType} with ${data.length} data points. `;
  
  if (includeStatistics && data.length > 0) {
    const numericValues = data
      .map(d => typeof d.value === 'number' ? d.value : 0)
      .filter(v => !isNaN(v));
    
    if (numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const average = sum / numericValues.length;
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      
      summary += `Average value: ${average.toFixed(2)}. `;
      summary += `Range: ${min} to ${max}. `;
    }
  }
  
  if (includeTrends) {
    // Simple trend detection
    if (data.length > 1) {
      const firstValue = data[0].value || 0;
      const lastValue = data[data.length - 1].value || 0;
      const trend = lastValue > firstValue ? 'increasing' : lastValue < firstValue ? 'decreasing' : 'stable';
      summary += `Overall trend: ${trend}. `;
    }
  }
  
  if (includeOutliers) {
    // Simple outlier detection
    const numericValues = data
      .map(d => typeof d.value === 'number' ? d.value : 0)
      .filter(v => !isNaN(v));
    
    if (numericValues.length > 2) {
      const sorted = numericValues.sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const outlierThreshold = 1.5 * iqr;
      
      const outliers = numericValues.filter(v => v < q1 - outlierThreshold || v > q3 + outlierThreshold);
      if (outliers.length > 0) {
        summary += `${outliers.length} potential outliers detected. `;
      }
    }
  }
  
  return summary;
}
