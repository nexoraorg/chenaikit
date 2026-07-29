import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetworkStats from '../NetworkStats';

describe('NetworkStats', () => {
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

    render(<NetworkStats />, { wrapper });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    );

    render(<NetworkStats />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('renders network statistics successfully', async () => {
    const mockStats = {
      totalNodes: 10,
      activeNodes: 8,
      totalStake: 10000000000n,
      averageReputation: 950,
      totalSubmissions: 1000,
      totalDisputes: 5,
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockStats }),
      } as Response)
    );

    render(<NetworkStats />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText(/1000/i)).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', async () => {
    const mockStats = {
      totalNodes: 10,
      activeNodes: 8,
      totalStake: 10000000000n,
      averageReputation: 950,
      totalSubmissions: 1000,
      totalDisputes: 5,
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockStats }),
      } as Response)
    );

    render(<NetworkStats />, { wrapper });

    await waitFor(() => {
      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label');
    });
  });
});
