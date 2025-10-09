import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { TransactionData, ChartProps, ZoomState, TooltipData } from '@chenaikit/core';
import { 
  DEFAULT_CHART_CONFIG, 
  getResponsiveConfig, 
  formatCurrency, 
  formatDateTime,
  generateTooltipContent,
  calculateZoomBounds,
  clampZoom,
  debounce,
  getAriaLabel
} from '@chenaikit/core';

interface TransactionFlowChartProps extends ChartProps {
  data: TransactionData[];
  showLabels?: boolean;
  showArrows?: boolean;
  nodeSize?: number;
  linkWidth?: number;
  onNodeClick?: (node: any) => void;
  onLinkClick?: (link: any) => void;
}

export const TransactionFlowChart: React.FC<TransactionFlowChartProps> = ({
  data,
  config = {},
  showLabels = true,
  showArrows = true,
  nodeSize = 8,
  linkWidth = 2,
  onDataPointClick,
  onNodeClick,
  onLinkClick,
  className = '',
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, translateX: 0, translateY: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const chartConfig = { ...DEFAULT_CHART_CONFIG, ...config };

  // Process data for visualization
  const processedData = React.useMemo(() => {
    const nodes = new Map();
    const links: any[] = [];

    data.forEach(transaction => {
      // Add source node
      if (!nodes.has(transaction.from)) {
        nodes.set(transaction.from, {
          id: transaction.from,
          label: transaction.from.slice(0, 8) + '...',
          type: 'account',
          value: 0,
          transactions: []
        });
      }

      // Add target node
      if (!nodes.has(transaction.to)) {
        nodes.set(transaction.to, {
          id: transaction.to,
          label: transaction.to.slice(0, 8) + '...',
          type: 'account',
          value: 0,
          transactions: []
        });
      }

      // Update node values
      const sourceNode = nodes.get(transaction.from);
      const targetNode = nodes.get(transaction.to);
      
      sourceNode.value -= transaction.amount;
      targetNode.value += transaction.amount;
      sourceNode.transactions.push(transaction);
      targetNode.transactions.push(transaction);

      // Add link
      links.push({
        source: transaction.from,
        target: transaction.to,
        amount: transaction.amount,
        asset: transaction.asset,
        timestamp: transaction.timestamp,
        type: transaction.type,
        status: transaction.status
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      links
    };
  }, [data]);

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

  // Create D3 visualization
  useEffect(() => {
    if (!svgRef.current || !processedData.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = chartConfig.margin;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        setZoom({
          scale: transform.k,
          translateX: transform.x,
          translateY: transform.y
        });
        g.attr('transform', transform);
      });

    svg.call(zoomBehavior);

    // Create force simulation
    const simulation = d3.forceSimulation(processedData.nodes)
      .force('link', d3.forceLink(processedData.links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(nodeSize + 5));

    // Create links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(processedData.links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', linkWidth)
      .attr('stroke-dasharray', (d: any) => d.status === 'pending' ? '5,5' : '0')
      .on('click', (event, d) => {
        event.stopPropagation();
        onLinkClick?.(d);
        onDataPointClick?.(d);
      })
      .on('mouseover', (event, d) => {
        const tooltipContent = generateTooltipContent([
          { label: 'Amount', value: formatCurrency(d.amount, d.asset), color: '#3B82F6' },
          { label: 'Type', value: d.type, color: '#10B981' },
          { label: 'Status', value: d.status, color: d.status === 'success' ? '#10B981' : '#EF4444' },
          { label: 'Time', value: formatDateTime(d.timestamp), color: '#6B7280' }
        ]);
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: tooltipContent
        });
      })
      .on('mouseout', () => setTooltip(null));

    // Add arrows to links
    if (showArrows) {
      const defs = svg.append('defs');
      const marker = defs
        .append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto');

      marker
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#999');

      link.attr('marker-end', 'url(#arrowhead)');
    }

    // Create nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(processedData.nodes)
      .join('circle')
      .attr('r', nodeSize)
      .attr('fill', (d: any) => {
        if (selectedNode === d.id) return '#3B82F6';
        return d.value > 0 ? '#10B981' : d.value < 0 ? '#EF4444' : '#6B7280';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(selectedNode === d.id ? null : d.id);
        onNodeClick?.(d);
        onDataPointClick?.(d);
      })
      .on('mouseover', (event, d) => {
        const tooltipContent = generateTooltipContent([
          { label: 'Account', value: d.id, color: '#3B82F6' },
          { label: 'Balance', value: formatCurrency(d.value), color: d.value > 0 ? '#10B981' : '#EF4444' },
          { label: 'Transactions', value: d.transactions.length, color: '#6B7280' }
        ]);
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: tooltipContent
        });
      })
      .on('mouseout', () => setTooltip(null));

    // Add labels
    if (showLabels) {
      const labels = g
        .append('g')
        .attr('class', 'labels')
        .selectAll('text')
        .data(processedData.nodes)
        .join('text')
        .text((d: any) => d.label)
        .attr('font-size', '12px')
        .attr('font-family', 'Arial, sans-serif')
        .attr('text-anchor', 'middle')
        .attr('dy', nodeSize + 15)
        .style('pointer-events', 'none')
        .style('user-select', 'none');
    }

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      if (showLabels) {
        g.selectAll('.labels text')
          .attr('x', (d: any) => d.x)
          .attr('y', (d: any) => d.y);
      }
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [processedData, dimensions, chartConfig, showLabels, showArrows, nodeSize, linkWidth, selectedNode, onDataPointClick, onNodeClick, onLinkClick]);

  return (
    <div 
      ref={containerRef}
      className={`transaction-flow-chart ${className}`}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        id={id}
        aria-label={ariaLabel || getAriaLabel(processedData.nodes, 'Transaction Flow')}
        aria-describedby={ariaDescribedby}
        style={{ display: 'block' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="chart-tooltip"
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

      {/* Zoom controls */}
      <div className="zoom-controls" style={{ position: 'absolute', top: 10, right: 10, zIndex: 100 }}>
        <button
          onClick={() => {
            const newZoom = { scale: zoom.scale * 1.2, translateX: zoom.translateX, translateY: zoom.translateY };
            setZoom(clampZoom(newZoom, { minScale: 0.1, maxScale: 10 }));
          }}
          style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '4px 8px',
            margin: '2px',
            cursor: 'pointer'
          }}
        >
          +
        </button>
        <button
          onClick={() => {
            const newZoom = { scale: zoom.scale * 0.8, translateX: zoom.translateX, translateY: zoom.translateY };
            setZoom(clampZoom(newZoom, { minScale: 0.1, maxScale: 10 }));
          }}
          style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '4px 8px',
            margin: '2px',
            cursor: 'pointer'
          }}
        >
          -
        </button>
        <button
          onClick={() => setZoom({ scale: 1, translateX: 0, translateY: 0 })}
          style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '4px 8px',
            margin: '2px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default TransactionFlowChart;
