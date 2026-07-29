import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DisputeFiling from '../DisputeFiling';

describe('DisputeFiling', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
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

  it('renders dispute filing form', () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );

    render(<DisputeFiling />, { wrapper });

    expect(screen.getByText(/file dispute/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/request id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/evidence/i)).toBeInTheDocument();
  });

  it('renders with pre-filled request ID', () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );

    render(<DisputeFiling requestId="req-123" />, { wrapper });

    const requestIdInput = screen.getByLabelText(/request id/i);
    expect(requestIdInput).toHaveValue('req-123');
    expect(requestIdInput).toBeDisabled();
  });

  it('shows validation error when fields are empty', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );

    render(<DisputeFiling />, { wrapper });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  it('submits dispute successfully', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)
    );

    render(<DisputeFiling />, { wrapper });

    const requestIdInput = screen.getByLabelText(/request id/i);
    const evidenceInput = screen.getByLabelText(/evidence/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    fireEvent.change(requestIdInput, { target: { value: 'req-123' } });
    fireEvent.change(evidenceInput, { target: { value: '{"reason": "high variance"}' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });

  it('shows error on invalid evidence JSON', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );

    render(<DisputeFiling />, { wrapper });

    const requestIdInput = screen.getByLabelText(/request id/i);
    const evidenceInput = screen.getByLabelText(/evidence/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    fireEvent.change(requestIdInput, { target: { value: 'req-123' } });
    fireEvent.change(evidenceInput, { target: { value: 'invalid json' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );

    render(<DisputeFiling />, { wrapper });

    const region = screen.getByRole('region');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-label');

    const form = screen.getByRole('form');
    expect(form).toBeInTheDocument();
  });
});
