import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { UserActivity, HeatmapData, ChartProps, TooltipData } from '@chenaikit/core';
import { 
  DEFAULT_CHART_CONFIG, 
  getResponsiveConfig, 
  formatNumber, 
  formatDateTime,
  generateTooltipContent,
  debounce,
  getAriaLabel,
  CHART_COLORS,
  hexToRgba
} from '@chenaikit/core';

interface UserActivityHeatmapProps extends ChartProps {
  data: UserActivity[];
  timeRange?: 'hour' | 'day' | 'week' | 'month';
  aggregation?: 'count' | 'sum' | 'average';
  colorScheme?: 'blue' | 'green' | 'red' | 'purple' | 'custom';
  customColors?: string[];
  showTooltip?: boolean;
  showLegend?: boolean;
  onCellClick?: (cell: any) => void;
  onTimeRangeChange?: (range: string) => void;
}

export const UserActivityHeatmap: React.FC<UserActivityHeatmapProps> = ({
  data,
  config = {},
  timeRange = 'day',
  aggregation = 'count',
  colorScheme = 'blue',
  customColors,
  showTooltip = true,
  showLegend = true,
  onDataPointClick,
  onCellClick,
  onTimeRangeChange,
  className = '',
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const chartConfig = { ...DEFAULT_CHART_CONFIG, ...config };

  // Get color scheme
  const getColorScheme = () => {
    if (customColors) return customColors;
    
    switch (colorScheme) {
      case 'green':
        return ['#F0FDF4', '#DCFCE7', '#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534', '#14532D'];
      case 'red':
        return ['#FEF2F2', '#FEE2E2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D'];
      case 'purple':
        return ['#FAF5FF', '#F3E8FF', '#E9D5FF', '#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6'];
      default: // blue
        return ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'];
    }
  };

  // Process data for heatmap
  const processedData = React.useMemo(() => {
    const colors = getColorScheme();
    const timeFormat = timeRange === 'hour' ? '%Y-%m-%d %H' : 
                      timeRange === 'day' ? '%Y-%m-%d' : 
                      timeRange === 'week' ? '%Y-W%U' : '%Y-%m';
    
    // Group data by time and category
    const grouped = data.reduce((acc, item) => {
      const timeKey = d3.timeFormat(timeFormat)(item.timestamp);
      const categoryKey = item.category;
      const key = `${timeKey}-${categoryKey}`;
      
      if (!acc[key]) {
        acc[key] = {
          time: timeKey,
          category: categoryKey,
          value: 0,
          count: 0,
          items: []
        };
      }
      
      acc[key].value += aggregation === 'count' ? 1 : item.value;
      acc[key].count += 1;
      acc[key].items.push(item);
      
      return acc;
    }, {} as Record<string, any>);

    const values = Object.values(grouped);
    const maxValue = Math.max(...values.map(v => v.value));
    const minValue = Math.min(...values.map(v => v.value));

    // Create color scale
    const colorScale = d3.scaleLinear<string>()
      .domain([minValue, maxValue])
      .range([colors[0], colors[colors.length - 1]]);

    return {
      cells: values.map(cell => ({
        ...cell,
        color: colorScale(cell.value),
        intensity: (cell.value - minValue) / (maxValue - minValue)
      })),
      maxValue,
      minValue,
      colorScale
    };
  }, [data, timeRange, aggregation, colorScheme, customColors]);

  // Get unique categories and times
  const categories = React.useMemo(() => {
    const uniqueCategories = [...new Set(processedData.cells.map(cell => cell.category))];
    return uniqueCategories.sort();
  }, [processedData.cells]);

  const times = React.useMemo(() => {
    const uniqueTimes = [...new Set(processedData.cells.map(cell => cell.time))];
    return uniqueTimes.sort();
  }, [processedData.cells]);

  // Handle resize
  const handleResize = useCallback(
    debounce(() => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        const responsiveConfig = getResponsiveConfig(width);
        setDimensions({
          width: responsiveConfig.width || chartConfig.width,
          height: responsiveConfig.height || chartConfig.height
        });
      }
    }, 250),
    [chartConfig]
  );

  // Initialize dimensions
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Create D3 heatmap
  useEffect(() => {
    if (!svgRef.current || !processedData.cells.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = chartConfig.margin;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate cell dimensions
    const cellWidth = innerWidth / times.length;
    const cellHeight = innerHeight / categories.length;

    // Create main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create cells
    const cells = g
      .append('g')
      .attr('class', 'heatmap-cells')
      .selectAll('rect')
      .data(processedData.cells)
      .join('rect')
      .attr('x', (d: any) => times.indexOf(d.time) * cellWidth)
      .attr('y', (d: any) => categories.indexOf(d.category) * cellHeight)
      .attr('width', cellWidth - 1)
      .attr('height', cellHeight - 1)
      .attr('fill', (d: any) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedCell(selectedCell === `${d.time}-${d.category}` ? null : `${d.time}-${d.category}`);
        onCellClick?.(d);
        onDataPointClick?.(d);
      })
      .on('mouseover', (event, d) => {
        if (showTooltip) {
          const tooltipContent = generateTooltipContent([
            { label: 'Time', value: d.time, color: '#3B82F6' },
            { label: 'Category', value: d.category, color: '#10B981' },
            { label: 'Value', value: formatNumber(d.value, 2), color: '#F59E0B' },
            { label: 'Count', value: d.count, color: '#6B7280' },
            { label: 'Intensity', value: formatNumber(d.intensity * 100, 1) + '%', color: '#8B5CF6' }
          ]);
          
          setTooltip({
            x: event.pageX,
            y: event.pageY,
            content: tooltipContent
          });
        }
      })
      .on('mouseout', () => setTooltip(null));

    // Add selection highlight
    if (selectedCell) {
      cells
        .filter((d: any) => `${d.time}-${d.category}` === selectedCell)
        .attr('stroke', '#3B82F6')
        .attr('stroke-width', 2);
    }

    // Add time labels
    g.append('g')
      .attr('class', 'time-labels')
      .selectAll('text')
      .data(times)
      .join('text')
      .attr('x', (d, i) => i * cellWidth + cellWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#6B7280')
      .text((d: string) => {
        if (timeRange === 'hour') return d.split(' ')[1];
        if (timeRange === 'day') return d.split('-')[2];
        if (timeRange === 'week') return d.split('-W')[1];
        return d.split('-')[1];
      });

    // Add category labels
    g.append('g')
      .attr('class', 'category-labels')
      .selectAll('text')
      .data(categories)
      .join('text')
      .attr('x', -5)
      .attr('y', (d, i) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('fill', '#6B7280')
      .attr('dominant-baseline', 'middle')
      .text((d: string) => d);

  }, [processedData, dimensions, chartConfig, selectedCell, showTooltip, timeRange, onDataPointClick, onCellClick]);

  return (
    <div 
      ref={containerRef}
      className={`user-activity-heatmap ${className}`}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        id={id}
        aria-label={ariaLabel || getAriaLabel(processedData.cells, 'User Activity Heatmap')}
        aria-describedby={ariaDescribedby}
        style={{ display: 'block' }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}

      {/* Legend */}
      {showLegend && (
        <div 
          className="heatmap-legend"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            background: 'white',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E7EB'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
            Activity Intensity
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: '#6B7280' }}>Low</span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {getColorScheme().map((color, index) => (
                <div
                  key={index}
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: color,
                    borderRadius: '2px'
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: '10px', color: '#6B7280' }}>High</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div 
        className="heatmap-controls"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 10
        }}
      >
        <select
          value={timeRange}
          onChange={(e) => onTimeRangeChange?.(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid #D1D5DB',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>

        <select
          value={aggregation}
          onChange={(e) => {
            // This would need to be handled by parent component
            console.log(`Change aggregation to ${e.target.value}`);
          }}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid #D1D5DB',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="count">Count</option>
          <option value="sum">Sum</option>
          <option value="average">Average</option>
        </select>
      </div>

      {/* Chart title */}
      <div 
        className="chart-title"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1F2937',
          zIndex: 10
        }}
      >
        User Activity Heatmap
      </div>
    </div>
  );
};

export default UserActivityHeatmap;
