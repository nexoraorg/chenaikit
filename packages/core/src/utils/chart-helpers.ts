import { ChartConfig, ExportOptions, ZoomState, TooltipData } from '../types/visualization';

// Color palettes for different chart types
export const CHART_COLORS = {
  primary: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
  categorical: ['#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB'],
  sequential: ['#F3F4F6', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563'],
  diverging: ['#DC2626', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']
};

// Default chart configuration
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  width: 800,
  height: 400,
  margin: { top: 20, right: 30, bottom: 40, left: 40 },
  colors: CHART_COLORS.primary,
  animation: true,
  responsive: true
};

// Responsive chart configuration
export function getResponsiveConfig(containerWidth: number): Partial<ChartConfig> {
  if (containerWidth < 600) {
    return {
      width: containerWidth - 40,
      height: 300,
      margin: { top: 15, right: 20, bottom: 30, left: 30 }
    };
  } else if (containerWidth < 900) {
    return {
      width: containerWidth - 60,
      height: 350,
      margin: { top: 20, right: 25, bottom: 35, left: 35 }
    };
  }
  return {
    width: Math.min(containerWidth - 80, 1200),
    height: 400,
    margin: { top: 20, right: 30, bottom: 40, left: 40 }
  };
}

// Format numbers for display
export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
  return value.toFixed(decimals);
}

// Format currency
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(value);
}

// Format date/time
export function formatDateTime(date: Date, format: 'short' | 'long' | 'time' = 'short'): string {
  switch (format) {
    case 'short':
      return date.toLocaleDateString();
    case 'long':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'time':
      return date.toLocaleTimeString();
    default:
      return date.toISOString();
  }
}

// Generate tooltip content
export function generateTooltipContent(data: TooltipData[]): string {
  return data.map(item => 
    `<div style="display: flex; align-items: center; margin: 2px 0;">
      <div style="width: 12px; height: 12px; background-color: ${item.color || '#3B82F6'}; margin-right: 8px; border-radius: 2px;"></div>
      <span style="font-weight: 500;">${item.label}:</span>
      <span style="margin-left: 8px;">${item.value}</span>
    </div>`
  ).join('');
}

// Calculate zoom bounds
export function calculateZoomBounds(
  scale: number,
  translateX: number,
  translateY: number,
  width: number,
  height: number
): { minScale: number; maxScale: number; bounds: { x: [number, number]; y: [number, number] } } {
  const minScale = 0.1;
  const maxScale = 10;
  
  const bounds = {
    x: [-width * (scale - 1), width * (scale - 1)] as [number, number],
    y: [-height * (scale - 1), height * (scale - 1)] as [number, number]
  };
  
  return { minScale, maxScale, bounds };
}

// Clamp zoom values
export function clampZoom(zoom: ZoomState, bounds: { minScale: number; maxScale: number }): ZoomState {
  return {
    scale: Math.max(bounds.minScale, Math.min(bounds.maxScale, zoom.scale)),
    translateX: zoom.translateX,
    translateY: zoom.translateY
  };
}

// Generate CSV content
export function generateCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

// Download file
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate unique ID
export function generateId(prefix: string = 'chart'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// Debounce function for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Accessibility helpers
export function getAriaLabel(data: any[], chartType: string): string {
  const dataCount = data.length;
  const dataRange = data.length > 0 ? 
    `Data ranges from ${Math.min(...data.map(d => d.value || 0))} to ${Math.max(...data.map(d => d.value || 0))}` : 
    'No data available';
  
  return `${chartType} chart with ${dataCount} data points. ${dataRange}. Use arrow keys to navigate, Enter to select.`;
}

// Color utilities
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getContrastColor(backgroundColor: string): string {
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

// Animation utilities
export function getAnimationConfig(duration: number = 750): {
  duration: number;
  ease: string;
  delay?: number;
} {
  return {
    duration,
    ease: 'ease-in-out',
    delay: 0
  };
}

// Data processing utilities
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const group = String(item[key]);
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function filterByDateRange<T extends { timestamp: Date }>(
  data: T[],
  startDate: Date,
  endDate: Date
): T[] {
  return data.filter(item => 
    item.timestamp >= startDate && item.timestamp <= endDate
  );
}
