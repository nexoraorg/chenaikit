import React, { useState } from 'react';
import FormValidationExample from './components/FormValidationExample';
import DataVisualizationExample from './components/DataVisualizationExample';
import { AnalyticsDashboard } from './components';
import './components/FormValidation.css';

const App: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<'forms' | 'visualization' | 'analytics'>('analytics');

  return (
    <div className="App">
      <header style={{ 
        background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', 
        color: 'white', 
        padding: '40px 20px', 
        textAlign: 'center' 
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
          ChenaiKit - BI & Analytics Dashboard
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '30px' }}>
          Advanced AI Insights & Blockchain Monitoring
        </p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => setActiveDemo('analytics')}
            style={{
              padding: '12px 24px',
              background: activeDemo === 'analytics' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
          >
            📈 Analytics Dashboard
          </button>
          <button
            onClick={() => setActiveDemo('forms')}
            style={{
              padding: '12px 24px',
              background: activeDemo === 'forms' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
          >
            📝 Forms
          </button>
          <button
            onClick={() => setActiveDemo('visualization')}
            style={{
              padding: '12px 24px',
              background: activeDemo === 'visualization' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
          >
            📊 Sandbox
          </button>
        </div>
      </header>
      
      <main style={{ minHeight: 'calc(100vh - 200px)' }}>
        {activeDemo === 'analytics' && <AnalyticsDashboard />}
        {activeDemo === 'forms' && <FormValidationExample />}
        {activeDemo === 'visualization' && <DataVisualizationExample />}
      </main>
      
      <footer style={{ 
        background: '#F9FAFB', 
        padding: '20px', 
        textAlign: 'center', 
        borderTop: '1px solid #E5E7EB' 
      }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>
          Built with ChenaiKit - Advanced AI and Blockchain Solutions
        </p>
      </footer>
    </div>
  );
};

export default App;
