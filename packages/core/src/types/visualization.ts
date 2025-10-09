export interface TransactionData {
  id: string;
  from: string;
  to: string;
  amount: number;
  asset: string;
  timestamp: Date;
  type: 'payment' | 'trust' | 'offer' | 'account_merge';
  status: 'success' | 'failed' | 'pending';
  fee: number;
  memo?: string;
}

export interface PerformanceMetrics {
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  timestamp: Date;
  dataset: string;
  version: string;
}

export interface UserActivity {
  userId: string;
  timestamp: Date;
  action: string;
  value: number;
  category: string;
  location?: string;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'account' | 'asset' | 'contract';
  connections: number;
  value: number;
  position: { x: number; y: number };
  metadata?: Record<string, any>;
}

export interface NetworkLink {
  source: string;
  target: string;
  weight: number;
  type: 'transaction' | 'trust' | 'offer';
  timestamp: Date;
}

export interface ChartConfig {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  colors: string[];
  animation: boolean;
  responsive: boolean;
}

export interface TooltipData {
  label: string;
  value: string | number;
  color?: string;
  category?: string;
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'csv' | 'pdf';
  filename: string;
  quality?: number;
  backgroundColor?: string;
}

export interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface ChartProps {
  data: any[];
  config?: Partial<ChartConfig>;
  onDataPointClick?: (data: any) => void;
  onZoom?: (state: ZoomState) => void;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export interface HeatmapData {
  x: string;
  y: string;
  value: number;
  timestamp: Date;
  category: string;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label: string;
  category?: string;
}

export interface ChartTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    text: string;
    grid: string;
  };
  fonts: {
    family: string;
    sizes: {
      title: number;
      subtitle: number;
      axis: number;
      tooltip: number;
    };
  };
  spacing: {
    margin: number;
    padding: number;
    gap: number;
  };
}
