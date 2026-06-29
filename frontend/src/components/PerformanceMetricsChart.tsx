import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { PerformanceMetrics, ChartProps, ZoomState } from '@chenaikit/core';
import {
  DEFAULT_CHART_CONFIG,
  getResponsiveConfig,
  formatNumber,
  formatDateTime,
  generateTooltipContent,
  debounce,
  getAriaLabel,
  CHART_COLORS,
  clampZoom,
} from '@chenaikit/core';
import { useChart } from '../contexts/ChartContext';

interface PerformanceMetricsChartProps extends ChartProps {
  data: PerformanceMetrics[];
  chartType?: 'line' | 'area' | 'bar' | 'radar' | 'multi-line';
  metrics?: ('accuracy' | 'precision' | 'recall' | 'f1Score')[];
  showLegend?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  onMetricClick?: (metric: string, value: number) => void;
  config?: any;
  onDataPointClick?: (data: any) => void;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  onChartTypeChange?: (chartType: PerformanceMetricsChartProps['chartType']) => void;
}

export const PerformanceMetricsChart: React.FC<PerformanceMetricsChartProps> = ({
  data,
  config = {},
  chartType: chartTypeProp = 'line',
  metrics = ['accuracy', 'precision', 'recall', 'f1Score'],
  showLegend = true,
  showGrid = true,
  animate = true,
  onDataPointClick,
  onMetricClick,
  className = '',
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  onChartTypeChange,
}) => {
  const { getColor, config: chartGlobalConfig } = useChart();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [chartType, setChartType] = useState<PerformanceMetricsChartProps['chartType']>(chartTypeProp);
  const [, setZoomRaw] = useState<ZoomState>({ scale: 1, translateX: 0, translateY: 0 });

  useEffect(() => {
    setChartType(chartTypeProp);
  }, [chartTypeProp]);

  const chartConfig = { ...DEFAULT_CHART_CONFIG, ...config };

  const processedData = React.useMemo(() => {
    if (chartType === 'radar') {
      const modelData = data.reduce((acc: Record<string, any>, item: PerformanceMetrics) => {
        if (!acc[item.modelName]) {
          acc[item.modelName] = {
            model: item.modelName,
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1Score: 0,
            count: 0,
          };
        }
        acc[item.modelName].accuracy += item.accuracy;
        acc[item.modelName].precision += item.precision;
        acc[item.modelName].recall += item.recall;
        acc[item.modelName].f1Score += item.f1Score;
        acc[item.modelName].count += 1;
        return acc;
      }, {} as Record<string, any>);

      return Object.values(modelData).map((model: any) => ({
        ...model,
        accuracy: model.accuracy / model.count,
        precision: model.precision / model.count,
        recall: model.recall / model.count,
        f1Score: model.f1Score / model.count,
      }));
    }

    return data.map((item) => ({
      ...item,
      timestamp: item.timestamp.getTime(),
      date: formatDateTime(item.timestamp, 'short'),
      fullDate: formatDateTime(item.timestamp, 'long'),
    }));
  }, [data, chartType]);

  const handleResize = useCallback(
    debounce(() => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        const responsiveConfig = getResponsiveConfig(width);
        setDimensions({
          width: responsiveConfig.width || chartConfig.width,
          height: responsiveConfig.height || chartConfig.height,
        });
      }
    }, 250),
    [chartConfig]
  );

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (!chartGlobalConfig.zoomEnabled) return;
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    setZoomRaw((prev) => clampZoom({ scale: prev.scale * factor, translateX: prev.translateX, translateY: prev.translateY }, { minScale: 0.1, maxScale: 10 }));
  }, [chartGlobalConfig.zoomEnabled]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0].payload;
      const tooltipContent = generateTooltipContent([
        { label: 'Model', value: row.modelName || 'Unknown', color: CHART_COLORS.primary[0] },
        { label: 'Accuracy', value: formatNumber((row.accuracy ?? 0) * 100, 2) + '%', color: CHART_COLORS.primary[1] },
        { label: 'Precision', value: formatNumber((row.precision ?? 0) * 100, 2) + '%', color: CHART_COLORS.primary[2] },
        { label: 'Recall', value: formatNumber((row.recall ?? 0) * 100, 2) + '%', color: CHART_COLORS.primary[3] },
        { label: 'F1 Score', value: formatNumber((row.f1Score ?? 0) * 100, 2) + '%', color: CHART_COLORS.primary[4] },
        { label: 'Date', value: row.fullDate || row.date, color: CHART_COLORS.primary[5] },
      ]);

      return (
        <div
          className="performance-tooltip"
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          dangerouslySetInnerHTML={{ __html: tooltipContent }}
        />
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    if (!showLegend || !payload) return null;

    return (
      <div className="performance-legend" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
        {payload.map((entry: any, index: number) => {
          const color = getColor(index);
          return (
            <button
              key={index}
              type="button"
              className="legend-item"
              aria-label={`Toggle ${entry.value} metric`}
              aria-pressed={selectedMetric === entry.dataKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                opacity: selectedMetric && selectedMetric !== entry.dataKey ? 0.5 : 1,
                transition: 'opacity 0.2s',
                border: 'none',
                background: 'transparent',
                padding: 0,
              }}
              onClick={() => {
                const next = selectedMetric === entry.dataKey ? null : entry.dataKey;
                setSelectedMetric(next);
                onMetricClick?.(entry.dataKey, 0);
              }}
            >
              <div style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '2px' }} />
              <span style={{ fontSize: '12px', color: '#374151' }}>{entry.value}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: chartConfig.margin,
      onMouseEnter: (dataPoint: any) => {
        if (onDataPointClick) onDataPointClick(dataPoint);
      },
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value * 100, 0) + '%'} />
            <Tooltip content={<CustomTooltip />} />
            {metrics.map((metric, index) => (
              <Area
                key={metric}
                type="monotone"
                dataKey={metric}
                stackId="1"
                stroke={getColor(index)}
                fill={getColor(index)}
                fillOpacity={0.6}
                strokeWidth={2}
                isAnimationActive={animate}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value * 100, 0) + '%'} />
            <Tooltip content={<CustomTooltip />} />
            {metrics.map((metric, index) => (
              <Bar key={metric} dataKey={metric} fill={getColor(index)} radius={[2, 2, 0, 0]} isAnimationActive={animate} />
            ))}
          </BarChart>
        );

      case 'radar':
        return (
          <RadarChart data={processedData} width={dimensions.width} height={dimensions.height} margin={chartConfig.margin}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis dataKey="model" stroke="#6B7280" fontSize={12} />
            <PolarRadiusAxis angle={90} domain={[0, 1]} stroke="#6B7280" fontSize={12} tickFormatter={(value) => formatNumber(value * 100, 0) + '%'} />
            {metrics.map((metric, index) => (
              <Radar
                key={metric}
                name={metric}
                dataKey={metric}
                stroke={getColor(index)}
                fill={getColor(index)}
                fillOpacity={0.3}
                strokeWidth={2}
                isAnimationActive={animate}
              />
            ))}
          </RadarChart>
        );

      case 'multi-line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value * 100, 0) + '%'} />
            <Tooltip content={<CustomTooltip />} />
            {metrics.map((metric, index) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={getColor(index)}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: getColor(index) }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                isAnimationActive={animate}
              />
            ))}
          </LineChart>
        );

      default:
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value * 100, 0) + '%'} />
            <Tooltip content={<CustomTooltip />} />
            {metrics.map((metric, index) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={getColor(index)}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: getColor(index) }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                isAnimationActive={animate}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className={`performance-metrics-chart ${className}`}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      id={id}
      aria-label={ariaLabel || getAriaLabel(processedData, 'Performance Metrics')}
      aria-describedby={ariaDescribedby}
      onWheel={handleWheel}
    >
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>

      <CustomLegend
        payload={metrics.map((metric, index) => ({
          value: metric.charAt(0).toUpperCase() + metric.slice(1),
          dataKey: metric,
          color: getColor(index),
        }))}
      />

      <div
        className="chart-title"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1F2937',
          zIndex: 10,
        }}
      >
        AI Model Performance Metrics
      </div>

      <div
        className="chart-controls"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 10,
        }}
      >
        {(['line', 'area', 'bar', 'radar'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              const next = chartType === type ? 'line' : type;
              setChartType(next);
              onChartTypeChange?.(next);
            }}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              background: chartType === type ? '#3B82F6' : 'white',
              color: chartType === type ? 'white' : '#374151',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PerformanceMetricsChart;