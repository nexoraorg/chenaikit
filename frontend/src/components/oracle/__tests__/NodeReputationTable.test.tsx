import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NodeReputationTable from '../NodeReputationTable';

describe('NodeReputationTable', () => {
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

    render(<NodeReputationTable />, { wrapper });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    );

    render(<NodeReputationTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('renders nodes table', async () => {
    const mockNodes = [
      {
        id: '1',
        address: 'GABC123DEF456',
        publicKey: 'pubkey-1',
        stake: 10000000000n,
        reputation: 1000,
        isActive: true,
        registeredAt: '2024-01-01T00:00:00Z',
        metadata: '{}',
      },
      {
        id: '2',
        address: 'GXYZ789UVW012',
        publicKey: 'pubkey-2',
        stake: 20000000000n,
        reputation: 950,
        isActive: false,
        registeredAt: '2024-01-02T00:00:00Z',
        metadata: '{}',
      },
    ];

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockNodes }),
      } as Response)
    );

    render(<NodeReputationTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/GABC123/i)).toBeInTheDocument();
      expect(screen.getByText(/GXYZ789/i)).toBeInTheDocument();
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('950')).toBeInTheDocument();
    });
  });

  it('displays active/inactive status correctly', async () => {
    const mockNodes = [
      {
        id: '1',
        address: 'GABC123DEF456',
        publicKey: 'pubkey-1',
        stake: 10000000000n,
        reputation: 1000,
        isActive: true,
        registeredAt: '2024-01-01T00:00:00Z',
        metadata: '{}',
      },
      {
        id: '2',
        address: 'GXYZ789UVW012',
        publicKey: 'pubkey-2',
        stake: 20000000000n,
        reputation: 950,
        isActive: false,
        registeredAt: '2024-01-02T00:00:00Z',
        metadata: '{}',
      },
    ];

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockNodes }),
      } as Response)
    );

    render(<NodeReputationTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/inactive/i)).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', async () => {
    const mockNodes = [
      {
        id: '1',
        address: 'GABC123DEF456',
        publicKey: 'pubkey-1',
        stake: 10000000000n,
        reputation: 1000,
        isActive: true,
        registeredAt: '2024-01-01T00:00:00Z',
        metadata: '{}',
      },
    ];

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockNodes }),
      } as Response)
    );

    render(<NodeReputationTable />, { wrapper });

    await waitFor(() => {
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('aria-label');
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });
});
