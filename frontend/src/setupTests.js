import '@testing-library/jest-dom';

// Mock @chenaikit/core
jest.mock('@chenaikit/core', () => ({
  ValidationRules: {
    email: () => ({
      custom: (value: any) => {
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email format';
        }
        return null;
      }
    }),
    required: () => ({
      custom: (value: any) => {
        if (!value) return 'This field is required';
        return null;
      }
    })
  },
  FormFieldConfig: {
    email: {
      label: 'Email',
      type: 'email',
      validation: ['email', 'required']
    },
    password: {
      label: 'Password',
      type: 'password',
      validation: ['required']
    }
  }
}));

// Mock chart components for testing
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  AreaChart: ({ children }: any) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }: any) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />
}));
