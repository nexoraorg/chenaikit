import React, { useState, useRef, useCallback } from 'react';
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
  const userActivity: UserActivity[] = Array.from({ length: 200 }, (_, i) => ({
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
  const links: NetworkLink[] = Array.from({ length: 30 }, (_, i) => ({
    source: `node_${Math.floor(Math.random() * 20)}`,
    target: `node_${Math.floor(Math.random() * 20)}`,
    weight: Math.random(),
    type: ['transaction', 'trust', 'offer'][Math.floor(Math.random() * 3)] as any,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
  }));

  return { transactions, performanceData, userActivity, nodes, links };
};

export const DataVisualizationExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'flow' | 'performance' | 'heatmap' | 'network'>('flow');
  const [data, setData] = useState(generateSampleData());
  const [isExporting, setIsExporting] = useState(false);
  
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
      console.error('Export failed:', error);
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
    setData(generateSampleData());
  }, []);

  return (
    <div className="data-visualization-example" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
          ChenaiKit Data Visualization Examples
        </h1>
        <p style={{ color: '#6B7280', marginBottom: '20px' }}>
          Interactive data visualization components for blockchain and AI applications
        </p>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={handleRefreshData}
            style={{
              padding: '8px 16px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Refresh Data
          </button>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {['png', 'svg', 'csv', 'pdf'].map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format as any)}
                disabled={isExporting}
                style={{
                  padding: '8px 16px',
                  background: isExporting ? '#9CA3AF' : '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Export {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: '20px' }}>
        {[
          { key: 'flow', label: 'Transaction Flow', icon: '🔄' },
          { key: 'performance', label: 'Performance Metrics', icon: '📊' },
          { key: 'heatmap', label: 'User Activity', icon: '🔥' },
          { key: 'network', label: 'Network Topology', icon: '🕸️' }
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              padding: '12px 20px',
              background: activeTab === key ? '#3B82F6' : 'transparent',
              color: activeTab === key ? 'white' : '#6B7280',
              border: 'none',
              borderBottom: activeTab === key ? '2px solid #3B82F6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Chart Content */}
      <div style={{ height: '600px', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
        {activeTab === 'flow' && (
          <div ref={flowChartRef} style={{ height: '100%' }}>
            <TransactionFlowChart
              data={data.transactions}
              showLabels={true}
              showArrows={true}
              nodeSize={10}
              linkWidth={3}
              onNodeClick={(node) => console.log('Node clicked:', node)}
              onLinkClick={(link) => console.log('Link clicked:', link)}
            />
          </div>
        )}

        {activeTab === 'performance' && (
          <div ref={performanceChartRef} style={{ height: '100%' }}>
            <PerformanceMetricsChart
              data={data.performanceData}
              chartType="line"
              metrics={['accuracy', 'precision', 'recall', 'f1Score']}
              showLegend={true}
              showGrid={true}
              animate={true}
              onMetricClick={(metric, value) => console.log('Metric clicked:', metric, value)}
            />
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div ref={heatmapRef} style={{ height: '100%' }}>
            <UserActivityHeatmap
              data={data.userActivity}
              timeRange="day"
              aggregation="count"
              colorScheme="blue"
              showTooltip={true}
              showLegend={true}
              onCellClick={(cell) => console.log('Cell clicked:', cell)}
              onTimeRangeChange={(range) => console.log('Time range changed:', range)}
            />
          </div>
        )}

        {activeTab === 'network' && (
          <div ref={networkRef} style={{ height: '100%' }}>
            <NetworkTopologyView
              nodes={data.nodes}
              links={data.links}
              layout="force"
              nodeSize={12}
              linkWidth={2}
              showLabels={true}
              showArrows={true}
              showNodeValues={false}
              enableDrag={true}
              enableZoom={true}
              onNodeClick={(node) => console.log('Node clicked:', node)}
              onLinkClick={(link) => console.log('Link clicked:', link)}
              onLayoutChange={(layout) => console.log('Layout changed:', layout)}
            />
          </div>
        )}
      </div>

      {/* Data Info */}
      <div style={{ marginTop: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', marginBottom: '12px' }}>
          Data Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
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
        </div>
      </div>

      {/* Export Controls */}
      <div style={{ marginTop: '20px', padding: '16px', background: '#F3F4F6', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', marginBottom: '12px' }}>
          Data Export
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportTransactions}
            style={{
              padding: '8px 16px',
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export Transactions CSV
          </button>
          <button
            onClick={handleExportPerformance}
            style={{
              padding: '8px 16px',
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export Performance CSV
          </button>
          <button
            onClick={handleExportUserActivity}
            style={{
              padding: '8px 16px',
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export User Activity CSV
          </button>
          <button
            onClick={handleExportNetwork}
            style={{
              padding: '8px 16px',
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export Network CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataVisualizationExample;
