import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LiveSubmissionFeed from '../LiveSubmissionFeed';

describe('LiveSubmissionFeed', () => {
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

    render(<LiveSubmissionFeed />, { wrapper });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    );

    render(<LiveSubmissionFeed />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('renders no activity message when no submissions', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { submissions: [] } }),
      } as Response)
    );

    render(<LiveSubmissionFeed />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/no activity/i)).toBeInTheDocument();
    });
  });

  it('renders submissions list', async () => {
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
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockActivity }),
      } as Response)
    );

    render(<LiveSubmissionFeed />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/GABC123/i)).toBeInTheDocument();
      expect(screen.getByText('commit')).toBeInTheDocument();
    });
  });

  it('toggles auto refresh', async () => {
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
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockActivity }),
      } as Response)
    );

    render(<LiveSubmissionFeed />, { wrapper });

    await waitFor(() => {
      const autoRefreshChip = screen.getByRole('switch');
      expect(autoRefreshChip).toBeInTheDocument();
    });

    const autoRefreshChip = screen.getByRole('switch');
    fireEvent.click(autoRefreshChip);

    await waitFor(() => {
      expect(autoRefreshChip).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('has proper accessibility attributes', async () => {
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
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockActivity }),
      } as Response)
    );

    render(<LiveSubmissionFeed />, { wrapper });

    await waitFor(() => {
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('aria-label');
    });
  });
});
