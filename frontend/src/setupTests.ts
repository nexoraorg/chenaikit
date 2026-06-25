import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import '../styles/accessibility.css';
import React from 'react';

expect.extend(toHaveNoViolations);

// ─── Recharts mocks ───────────────────────────────────────────────────────────
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  LineChart: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'line' }),
  XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
  Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
  AreaChart: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: () => React.createElement('div', { 'data-testid': 'area' }),
  BarChart: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
}));

// ─── window.matchMedia mock ────────────────────────────────────────────────────
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

// ─── localStorage / sessionStorage mocks ─────────────────────────────────────
const makeStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// ─── URL helpers mock ─────────────────────────────────────────────────────────
if (typeof window.URL.createObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: jest.fn(() => 'blob:mock-url'),
  });
}
if (typeof window.URL.revokeObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: jest.fn(),
  });
}

// ─── requestAnimationFrame mock ────────────────────────────────────────────────
// Use setTimeout so recursive rAF calls in components (e.g. Toast progress bar)
// are deferred rather than executed synchronously, preventing stack overflows.
global.requestAnimationFrame = jest.fn((cb) => setTimeout(() => cb(performance.now()), 0) as unknown as number);
global.cancelAnimationFrame = jest.fn((id: number) => clearTimeout(id));

// ─── ResizeObserver mock ───────────────────────────────────────────────────────
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// ─── IntersectionObserver mock ────────────────────────────────────────────────
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// ─── Clean up between tests ───────────────────────────────────────────────────
beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  localStorageMock.clear.mockClear();
  sessionStorageMock.clear.mockClear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
});

afterEach(() => {
  jest.clearAllTimers();
});
