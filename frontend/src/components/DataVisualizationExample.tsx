import React, { useState, useRef, useCallback } from 'react';
import { Box, Button, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { TransactionData, PerformanceMetrics, UserActivity, NetworkNode, NetworkLink } from '@chenaikit/core';
import {
  exportVisualization,
  exportTransactionData,
  exportPerformanceData,
  exportUserActivityData,
  exportNetworkData
} from '@chenaikit/core';
import TransactionFlowChart from './TransactionFlowChart';
import PerformanceMetricsChart from './PerformanceMetricsChart';
import UserActivityHeatmap from './UserActivityHeatmap';
import NetworkTopologyView from './NetworkTopologyView';
import { CollapsiblePanel } from './mobile';
import useUndoRedo from '../hooks/useUndoRedo';

// Generate sample data
const generateSampleData = () => {
  // Generate transaction data
  const transactions: TransactionData[] = Array.from({ length: 50 }, (_, i) => ({
    id: `tx_${i.toString().padStart(3, '0')}`,
    from: `G${Math.random().toString(36).substr(2, 55)}`,
    to: `G${Math.random().toString(36).substr(2, 55)}`,
    amount: Math.random() * 1000,
    asset: ['XLM', 'USDC', 'BTC', 'ETH'][Math.floor(Math.random() * 4)],
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    type: ['payment', 'trust', 'offer', 'account_merge'][Math.floor(Math.random() * 4)] as any,
    status: ['success', 'failed', 'pending'][Math.floor(Math.random() * 3)] as any,
    fee: Math.random() * 0.01,
    memo: Math.random() > 0.7 ? `Memo ${i}` : undefined
  }));

  // Generate performance metrics
  const performanceData: PerformanceMetrics[] = Array.from({ length: 30 }, (_, i) => ({
    modelName: `Model_${Math.floor(i / 10) + 1}`,
    accuracy: 0.7 + Math.random() * 0.3,
    precision: 0.6 + Math.random() * 0.4,
    recall: 0.5 + Math.random() * 0.5,
    f1Score: 0.4 + Math.random() * 0.6,
    timestamp: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000),
    dataset: ['train', 'validation', 'test'][Math.floor(Math.random() * 3)],
    version: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}`
  }));

  // Generate user activity data
  const userActivity: UserActivity[] = Array.from({ length: 200 }, () => ({
    userId: `user_${Math.floor(Math.random() * 20)}`,
    timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    action: ['login', 'transaction', 'view', 'click', 'scroll'][Math.floor(Math.random() * 5)],
    value: Math.random() * 100,
    category: ['authentication', 'trading', 'navigation', 'engagement'][Math.floor(Math.random() * 4)],
    location: Math.random() > 0.5 ? `Location_${Math.floor(Math.random() * 10)}` : undefined
  }));

  // Generate network nodes
  const nodes: NetworkNode[] = Array.from({ length: 20 }, (_, i) => ({
    id: `node_${i}`,
    label: `Node ${i}`,
    type: ['account', 'asset', 'contract'][Math.floor(Math.random() * 3)] as any,
    connections: Math.floor(Math.random() * 15),
    value: Math.random() * 1000,
    position: { x: Math.random() * 800, y: Math.random() * 600 },
    metadata: { region: `Region_${Math.floor(Math.random() * 5)}` }
  }));

  // Generate network links
  const links: NetworkLink[] = Array.from({ length: 30 }, () => ({
    source: `node_${Math.floor(Math.random() * 20)}`,
    target: `node_${Math.floor(Math.random() * 20)}`,
    weight: Math.random(),
    type: ['transaction', 'trust', 'offer'][Math.floor(Math.random() * 3)] as any,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
  }));

  return { transactions, performanceData, userActivity, nodes, links };
};

type VizTab = 'flow' | 'performance' | 'heatmap' | 'network';

const VIZ_TABS: Array<{ id: VizTab; label: string }> = [
  { id: 'flow', label: 'Transaction Flow' },
  { id: 'performance', label: 'Performance Metrics' },
  { id: 'heatmap', label: 'User Activity' },
  { id: 'network', label: 'Network Topology' },
];

export const DataVisualizationExample: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [activeTab, setActiveTab] = useState<VizTab>('flow');
  const [data, setData] = useState(generateSampleData());
  const [isExporting, setIsExporting] = useState(false);
  const { trackAction } = useUndoRedo();
  
  const flowChartRef = useRef<HTMLDivElement>(null);
  const performanceChartRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<HTMLDivElement>(null);

  // Export handlers
  const handleExport = useCallback(async (format: 'png' | 'svg' | 'csv' | 'pdf') => {
    setIsExporting(true);
    try {
      let element: HTMLElement | null = null;
      let exportData: any[] = [];
      let filename = '';

      switch (activeTab) {
        case 'flow':
          element = flowChartRef.current;
          exportData = data.transactions;
          filename = 'transaction-flow';
          break;
        case 'performance':
          element = performanceChartRef.current;
          exportData = data.performanceData;
          filename = 'performance-metrics';
          break;
        case 'heatmap':
          element = heatmapRef.current;
          exportData = data.userActivity;
          filename = 'user-activity';
          break;
        case 'network':
          element = networkRef.current;
          exportData = [...data.nodes, ...data.links];
          filename = 'network-topology';
          break;
      }

      if (element && exportData.length > 0) {
        await exportVisualization(element, exportData, format, filename);
      }
    } catch (error) {
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, data]);

  // Specific export handlers
  const handleExportTransactions = useCallback(() => {
    exportTransactionData(data.transactions, { format: 'csv', filename: 'transactions' });
  }, [data.transactions]);

  const handleExportPerformance = useCallback(() => {
    exportPerformanceData(data.performanceData, { format: 'csv', filename: 'performance' });
  }, [data.performanceData]);

  const handleExportUserActivity = useCallback(() => {
    exportUserActivityData(data.userActivity, { format: 'csv', filename: 'user-activity' });
  }, [data.userActivity]);

  const handleExportNetwork = useCallback(() => {
    exportNetworkData(data.nodes, data.links, { format: 'csv', filename: 'network' });
  }, [data.nodes, data.links]);

  // Refresh data
  const handleRefreshData = useCallback(() => {
    const oldData = data;
    trackAction(
      'data_modification',
      'Refreshed visualization data',
      () => setData(generateSampleData()),
      () => setData(oldData),
    );
  }, [data, trackAction]);

  const handleTabChange = useCallback(
    (nextTab: VizTab) => {
      const prevTab = activeTab;
      if (prevTab === nextTab) return;
      const label = VIZ_TABS.find((t) => t.id === nextTab)?.label ?? nextTab;
      trackAction(
        'layout_change',
        `Switched to ${label} view`,
        () => setActiveTab(nextTab),
        () => setActiveTab(prevTab),
      );
    },
    [activeTab, trackAction],
  );

  return (
    <Box
      className="data-visualization-example"
      sx={{
        p: { xs: 2, sm: 2.5 },
        maxWidth: 1200,
        mx: 'auto',
        overflowX: 'hidden',
        width: '100%',
      }}
    >
      <Box sx={{ mb: 2.5 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            fontWeight: 600,
            color: 'text.primary',
            mb: 1,
          }}
        >
          ChenaiKit Data Visualization Examples
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 2.5, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          Interactive data visualization components for blockchain and AI applications
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
          <Button variant="contained" onClick={handleRefreshData} aria-label="Refresh visualization data" sx={{ minHeight: 44 }}>
            Refresh Data
          </Button>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} role="group" aria-label="Export options">
            {(['png', 'svg', 'csv', 'pdf'] as const).map((format) => (
              <Button
                key={format}
                variant="contained"
                color="success"
                onClick={() => handleExport(format)}
                disabled={isExporting}
                aria-label={`Export current view as ${format.toUpperCase()}`}
                sx={{ minHeight: 44 }}
              >
                Export {format.toUpperCase()}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, value: VizTab) => handleTabChange(value)}
        aria-label="Visualization types"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}
      >
        {VIZ_TABS.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={tab.label}
            id={`viz-tab-${tab.id}`}
            aria-controls={`viz-panel-${tab.id}`}
          />
        ))}
      </Tabs>

      {VIZ_TABS.map((tab) => (
        <Box
          key={tab.id}
          role="tabpanel"
          id={`viz-panel-${tab.id}`}
          aria-labelledby={`viz-tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          sx={{
            height: { xs: 360, sm: 480, md: 600 },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            maxWidth: '100%',
          }}
        >
          {tab.id === 'flow' && (
            <div ref={flowChartRef} style={{ height: '100%' }}>
              <TransactionFlowChart
                data={data.transactions}
                showLabels={!isMobile}
                showArrows={true}
                nodeSize={isMobile ? 8 : 10}
                linkWidth={isMobile ? 2 : 3}
              />
            </div>
          )}

          {tab.id === 'performance' && (
            <div ref={performanceChartRef} style={{ height: '100%' }}>
              <PerformanceMetricsChart
                data={data.performanceData}
                chartType="line"
                metrics={['accuracy', 'precision', 'recall', 'f1Score']}
                showLegend={!isMobile}
                showGrid={true}
                animate={!reduceMotion && !isMobile}
              />
            </div>
          )}

          {tab.id === 'heatmap' && (
            <div ref={heatmapRef} style={{ height: '100%' }}>
              <UserActivityHeatmap
                data={data.userActivity}
                timeRange="day"
                aggregation="count"
                colorScheme="blue"
                showTooltip={true}
                showLegend={!isMobile}
              />
            </div>
          )}

          {tab.id === 'network' && (
            <div ref={networkRef} style={{ height: '100%' }}>
              <NetworkTopologyView
                nodes={data.nodes}
                links={data.links}
                layout="force"
                nodeSize={isMobile ? 10 : 12}
                linkWidth={2}
                showLabels={!isMobile}
                showArrows={true}
                showNodeValues={false}
                enableDrag={true}
                enableZoom={true}
              />
            </div>
          )}
        </Box>
      ))}

      <CollapsiblePanel title="Data Summary" defaultExpanded={!isMobile} id="viz-data-summary">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 2,
          }}
        >
          <div>
            <strong>Transactions:</strong> {data.transactions.length}
          </div>
          <div>
            <strong>Performance Records:</strong> {data.performanceData.length}
          </div>
          <div>
            <strong>User Activities:</strong> {data.userActivity.length}
          </div>
          <div>
            <strong>Network Nodes:</strong> {data.nodes.length}
          </div>
          <div>
            <strong>Network Links:</strong> {data.links.length}
          </div>
        </Box>
      </CollapsiblePanel>

      <Box sx={{ mt: 2 }}>
        <CollapsiblePanel title="Data Export" defaultExpanded={false} id="viz-data-export">
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="contained" color="secondary" onClick={handleExportTransactions} sx={{ minHeight: 44 }}>
              Export Transactions CSV
            </Button>
            <Button variant="contained" color="secondary" onClick={handleExportPerformance} sx={{ minHeight: 44 }}>
              Export Performance CSV
            </Button>
            <Button variant="contained" color="secondary" onClick={handleExportUserActivity} sx={{ minHeight: 44 }}>
              Export User Activity CSV
            </Button>
            <Button variant="contained" color="secondary" onClick={handleExportNetwork} sx={{ minHeight: 44 }}>
              Export Network CSV
            </Button>
          </Box>
        </CollapsiblePanel>
      </Box>
    </Box>
  );
};

export default DataVisualizationExample;
