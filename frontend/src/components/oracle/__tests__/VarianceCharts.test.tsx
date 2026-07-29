import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VarianceCharts from '../VarianceCharts';

describe('VarianceCharts', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      } as Response)
    );

    render(<VarianceCharts />, { wrapper });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    );

    render(<VarianceCharts />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('renders analytics charts', async () => {
    const mockActivity = {
      submissions: [
        {
          id: '1',
          requestId: 'req-1',
          node: { address: 'GABC123DEF456', reputation: 1000 },
          modelHash: 'hash-1',
          phase: 'commit',
          status: 'committed',
          committedAt: '2024-01-01T00:00:00Z',
        },
      ],
      disputes: [
        {
          id: '1',
          requestId: 'req-1',
          status: 'pending',
          reason: 'high variance',
        },
      ],
      slashEvents: [
        {
          id: '1',
          nodeId: 'GABC123DEF456',
          reason: 'no reveal',
          amount: 100000n,
        },
      ],
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockActivity }),
      } as Response)
    );

    render(<VarianceCharts />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/submission variance/i)).toBeInTheDocument();
      expect(screen.getByText(/dispute status/i)).toBeInTheDocument();
      expect(screen.getByText(/slash reasons/i)).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', async () => {
    const mockActivity = {
      submissions: [],
      disputes: [],
      slashEvents: [],
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockActivity }),
      } as Response)
    );

    render(<VarianceCharts />, { wrapper });

    await waitFor(() => {
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('aria-label');

      const articles = screen.getAllByRole('article');
      expect(articles.length).toBeGreaterThan(0);
    });
  });
});
