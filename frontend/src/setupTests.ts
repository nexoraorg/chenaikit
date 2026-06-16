import '@testing-library/jest-dom';
import React from 'react';

// Mock chart components for testing
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => 
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  LineChart: ({ children }: any) => 
    React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => 
    React.createElement('div', { 'data-testid': 'line' }),
  XAxis: () => 
    React.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => 
    React.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => 
    React.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => 
    React.createElement('div', { 'data-testid': 'tooltip' }),
  Legend: () => 
    React.createElement('div', { 'data-testid': 'legend' }),
  AreaChart: ({ children }: any) => 
    React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: () => 
    React.createElement('div', { 'data-testid': 'area' }),
  BarChart: ({ children }: any) => 
    React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => 
    React.createElement('div', { 'data-testid': 'bar' })
}));
