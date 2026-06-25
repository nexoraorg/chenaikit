import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import '../styles/accessibility.css';
import mockReact from 'react';

expect.extend(toHaveNoViolations);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock chart components for testing
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => 
    mockReact.createElement('div', { 'data-testid': 'responsive-container' }, children),
  LineChart: ({ children }: any) => 
    mockReact.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => 
    mockReact.createElement('div', { 'data-testid': 'line' }),
  XAxis: () => 
    mockReact.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => 
    mockReact.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => 
    mockReact.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => 
    mockReact.createElement('div', { 'data-testid': 'tooltip' }),
  Legend: () => 
    mockReact.createElement('div', { 'data-testid': 'legend' }),
  AreaChart: ({ children }: any) => 
    mockReact.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: () => 
    mockReact.createElement('div', { 'data-testid': 'area' }),
  BarChart: ({ children }: any) => 
    mockReact.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => 
    mockReact.createElement('div', { 'data-testid': 'bar' })
}));