import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { NetworkNode, NetworkLink, ChartProps, ZoomState, TooltipData } from '@chenaikit/core';
import { 
  DEFAULT_CHART_CONFIG, 
  getResponsiveConfig, 
  formatNumber, 
  formatDateTime,
  generateTooltipContent,
  calculateZoomBounds,
  clampZoom,
  debounce,
  getAriaLabel,
  CHART_COLORS
} from '@chenaikit/core';

interface NetworkTopologyViewProps extends ChartProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  layout?: 'force' | 'hierarchical' | 'circular' | 'grid';
  nodeSize?: number | ((node: NetworkNode) => number);
  linkWidth?: number | ((link: NetworkLink) => number);
  showLabels?: boolean;
  showArrows?: boolean;
  showNodeValues?: boolean;
  enableDrag?: boolean;
  enableZoom?: boolean;
  onNodeClick?: (node: NetworkNode) => void;
  onLinkClick?: (link: NetworkLink) => void;
  onLayoutChange?: (layout: string) => void;
}

export const NetworkTopologyView: React.FC<NetworkTopologyViewProps> = ({
  nodes,
  links,
  config = {},
  layout = 'force',
  nodeSize = 8,
  linkWidth = 2,
  showLabels = true,
  showArrows = true,
  showNodeValues = false,
  enableDrag = true,
  enableZoom = true,
  onDataPointClick,
  onNodeClick,
  onLinkClick,
  onLayoutChange,
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
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [simulation, setSimulation] = useState<d3.Simulation<NetworkNode, NetworkLink> | null>(null);

  const chartConfig = { ...DEFAULT_CHART_CONFIG, ...config };

  // Process nodes and links
  const processedData = React.useMemo(() => {
    const processedNodes = nodes.map(node => ({
      ...node,
      size: typeof nodeSize === 'function' ? nodeSize(node) : nodeSize,
      color: getNodeColor(node),
      opacity: 1
    }));

    const processedLinks = links.map(link => ({
      ...link,
      width: typeof linkWidth === 'function' ? linkWidth(link) : linkWidth,
      color: getLinkColor(link),
      opacity: 1
    }));

    return { nodes: processedNodes, links: processedLinks };
  }, [nodes, links, nodeSize, linkWidth]);

  // Get node color based on type and connections
  const getNodeColor = (node: NetworkNode): string => {
    switch (node.type) {
      case 'account':
        return node.connections > 10 ? CHART_COLORS.primary[0] : CHART_COLORS.primary[1];
      case 'asset':
        return node.connections > 5 ? CHART_COLORS.primary[2] : CHART_COLORS.primary[3];
      case 'contract':
        return node.connections > 3 ? CHART_COLORS.primary[4] : CHART_COLORS.primary[5];
      default:
        return CHART_COLORS.primary[0];
    }
  };

  // Get link color based on type and weight
  const getLinkColor = (link: NetworkLink): string => {
    switch (link.type) {
      case 'transaction':
        return link.weight > 0.5 ? '#3B82F6' : '#93C5FD';
      case 'trust':
        return link.weight > 0.5 ? '#10B981' : '#86EFAC';
      case 'offer':
        return link.weight > 0.5 ? '#F59E0B' : '#FCD34D';
      default:
        return '#6B7280';
    }
  };

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

  // Create D3 network visualization
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
    if (enableZoom) {
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
    }

    // Create force simulation
    const forceSimulation = d3.forceSimulation(processedData.nodes)
      .force('link', d3.forceLink(processedData.links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.size + 5));

    setSimulation(forceSimulation);

    // Create links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(processedData.links)
      .join('line')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => d.width)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedLink(selectedLink === `${d.source.id}-${d.target.id}` ? null : `${d.source.id}-${d.target.id}`);
        onLinkClick?.(d);
        onDataPointClick?.(d);
      })
      .on('mouseover', (event, d) => {
        const tooltipContent = generateTooltipContent([
          { label: 'Source', value: d.source.id, color: '#3B82F6' },
          { label: 'Target', value: d.target.id, color: '#10B981' },
          { label: 'Weight', value: formatNumber(d.weight, 3), color: '#F59E0B' },
          { label: 'Type', value: d.type, color: '#8B5CF6' },
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
      .attr('r', (d: any) => d.size)
      .attr('fill', (d: any) => d.color)
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
          { label: 'ID', value: d.id, color: '#3B82F6' },
          { label: 'Type', value: d.type, color: '#10B981' },
          { label: 'Connections', value: d.connections, color: '#F59E0B' },
          { label: 'Value', value: formatNumber(d.value), color: '#8B5CF6' },
          { label: 'Label', value: d.label, color: '#6B7280' }
        ]);
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: tooltipContent
        });
      })
      .on('mouseout', () => setTooltip(null));

    // Add drag behavior
    if (enableDrag) {
      const drag = d3.drag<SVGCircleElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) forceSimulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) forceSimulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      node.call(drag);
    }

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
        .attr('dy', (d: any) => d.size + 15)
        .style('pointer-events', 'none')
        .style('user-select', 'none');
    }

    // Add node values
    if (showNodeValues) {
      const values = g
        .append('g')
        .attr('class', 'node-values')
        .selectAll('text')
        .data(processedData.nodes)
        .join('text')
        .text((d: any) => formatNumber(d.value))
        .attr('font-size', '10px')
        .attr('font-family', 'Arial, sans-serif')
        .attr('text-anchor', 'middle')
        .attr('dy', (d: any) => d.size + 30)
        .style('pointer-events', 'none')
        .style('user-select', 'none')
        .style('fill', '#6B7280');
    }

    // Update positions on simulation tick
    forceSimulation.on('tick', () => {
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

      if (showNodeValues) {
        g.selectAll('.node-values text')
          .attr('x', (d: any) => d.x)
          .attr('y', (d: any) => d.y);
      }
    });

    // Apply layout
    switch (layout) {
      case 'hierarchical':
        // Simple hierarchical layout
        processedData.nodes.forEach((node, i) => {
          node.x = innerWidth / 2;
          node.y = (i / processedData.nodes.length) * innerHeight;
        });
        break;
      case 'circular':
        // Circular layout
        const radius = Math.min(innerWidth, innerHeight) / 2 - 50;
        processedData.nodes.forEach((node, i) => {
          const angle = (i / processedData.nodes.length) * 2 * Math.PI;
          node.x = innerWidth / 2 + radius * Math.cos(angle);
          node.y = innerHeight / 2 + radius * Math.sin(angle);
        });
        break;
      case 'grid':
        // Grid layout
        const cols = Math.ceil(Math.sqrt(processedData.nodes.length));
        processedData.nodes.forEach((node, i) => {
          node.x = (i % cols) * (innerWidth / cols) + (innerWidth / cols) / 2;
          node.y = Math.floor(i / cols) * (innerHeight / Math.ceil(processedData.nodes.length / cols)) + 50;
        });
        break;
      default: // force
        // Let force simulation handle positioning
        break;
    }

    // Cleanup
    return () => {
      forceSimulation.stop();
    };
  }, [processedData, dimensions, chartConfig, layout, showLabels, showArrows, showNodeValues, enableDrag, enableZoom, selectedNode, selectedLink, onDataPointClick, onNodeClick, onLinkClick]);

  return (
    <div 
      ref={containerRef}
      className={`network-topology-view ${className}`}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        id={id}
        aria-label={ariaLabel || getAriaLabel(processedData.nodes, 'Network Topology')}
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
          className="network-tooltip"
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

      {/* Layout controls */}
      <div className="layout-controls" style={{ position: 'absolute', top: 10, right: 10, zIndex: 100 }}>
        {['force', 'hierarchical', 'circular', 'grid'].map((layoutType) => (
          <button
            key={layoutType}
            onClick={() => onLayoutChange?.(layoutType)}
            style={{
              background: layout === layoutType ? '#3B82F6' : 'white',
              color: layout === layoutType ? 'white' : '#374151',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '4px 8px',
              margin: '2px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {layoutType.charAt(0).toUpperCase() + layoutType.slice(1)}
          </button>
        ))}
      </div>

      {/* Zoom controls */}
      {enableZoom && (
        <div className="zoom-controls" style={{ position: 'absolute', top: 10, left: 10, zIndex: 100 }}>
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
      )}

      {/* Chart title */}
      <div 
        className="chart-title"
        style={{
          position: 'absolute',
          top: '16px',
          left: enableZoom ? '120px' : '16px',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1F2937',
          zIndex: 10
        }}
      >
        Network Topology
      </div>
    </div>
  );
};

export default NetworkTopologyView;
