import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

jest.mock('../../utils/errorLogger', () => ({
  getErrorCode: () => 'ERR-RENDER',
  logError: jest.fn().mockResolvedValue({
    message: 'Crash',
    name: 'Error',
    type: 'rendering',
    code: 'ERR-RENDER',
    occurredAt: '2026-01-01T00:00:00.000Z',
    context: { boundary: 'Test boundary' },
    userAgent: 'jest',
    language: 'en',
    platform: 'test',
    url: 'http://localhost/',
    viewport: { width: 1024, height: 768 },
  }),
}));

const ThrowingComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Crash');
  }

  return <div>Recovered content</div>;
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders a friendly fallback when a child component crashes', async () => {
    render(
      <ErrorBoundary name="Test boundary">
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test boundary needs attention')).toBeInTheDocument();
    expect(screen.getByText(/ERR-RENDER/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Your data is still safe/)).toBeInTheDocument());
  });

  it('resets the failed section when retry is clicked', () => {
    let shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary name="Test boundary">
        <ThrowingComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    shouldThrow = false;
    rerender(
      <ErrorBoundary name="Test boundary">
        <ThrowingComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });
});
