import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeWebTracing } from './tracing/webTracer';

// Initialize OpenTelemetry Web Tracing before React mounts
const tracingEnabled = process.env.REACT_APP_TRACING_ENABLED === 'true';

if (tracingEnabled) {
  initializeWebTracing({
    serviceName: 'chenaikit-frontend',
    environment: process.env.NODE_ENV || 'production',
    version: process.env.REACT_APP_VERSION || '1.0.0',
    otlpEndpoint: process.env.REACT_APP_OTEL_ENDPOINT || 'http://localhost:4318/v1/traces',
    sampleRate: Number(process.env.REACT_APP_TRACE_SAMPLE_RATE) || 0.01,
    maxTracesPerMinute: Number(process.env.REACT_APP_MAX_TRACES_PER_MINUTE) || 1000,
  });
  console.log('🔍 Web tracing initialized');
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);