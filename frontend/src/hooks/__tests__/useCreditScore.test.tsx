import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreditScore } from '../useCreditScore';

// useCreditScore uses fetch() for real API calls and setTimeout for mock mode.
// We use fake timers so the 1-second mock delay resolves instantly.

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('hooks/useCreditScore', () => {
  // ─── initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with loading=true, data=null, error=null', () => {
      const { result } = renderHook(() => useCreditScore());
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // ─── mock mode (default) ───────────────────────────────────────────────────

  describe('mock mode', () => {
    it('resolves mock data after the delay', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: true }));
      act(() => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('returns a currentScore between 0 and 100', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: true }));
      act(() => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      const score = result.current.data!.currentScore;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('returns a non-empty history array', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: true }));
      act(() => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data!.history.length).toBeGreaterThan(0);
    });

    it('returns a non-empty riskFactors array', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: true }));
      act(() => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data!.riskFactors.length).toBeGreaterThan(0);
    });

    it('includes a lastUpdated Date instance', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: true }));
      act(() => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data!.lastUpdated).toBeInstanceOf(Date);
    });
  });

  // ─── API mode (fetch) ──────────────────────────────────────────────────────

  describe('API mode', () => {
    const mockResponse = {
      currentScore: 78,
      previousScore: 72,
      history: [{ score: 72, timestamp: new Date() }],
      riskFactors: [],
      lastUpdated: new Date(),
    };

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fetches from /api/credit-score by default', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: false }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetch).toHaveBeenCalledWith('/api/credit-score');
    });

    it('fetches from /api/accounts/:id/credit-score when accountId provided', async () => {
      const { result } = renderHook(() =>
        useCreditScore({ mockData: false, accountId: 'acc-123' })
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetch).toHaveBeenCalledWith('/api/accounts/acc-123/credit-score');
    });

    it('fetches from /api/users/:id/credit-score when userId provided', async () => {
      const { result } = renderHook(() =>
        useCreditScore({ mockData: false, userId: 'usr-456' })
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetch).toHaveBeenCalledWith('/api/users/usr-456/credit-score');
    });

    it('sets data from the API response', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: false }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual(mockResponse);
    });

    it('sets error when fetch returns a non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as any);
      const { result } = renderHook(() => useCreditScore({ mockData: false }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toContain('Failed to fetch credit score');
      expect(result.current.data).toBeNull();
    });

    it('sets error when fetch throws a network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useCreditScore({ mockData: false }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe('Network error');
      expect(result.current.data).toBeNull();
    });
  });

  // ─── refetch ──────────────────────────────────────────────────────────────

  describe('refetch()', () => {
    it('re-enters loading state when called', async () => {
      const { result } = renderHook(() => useCreditScore({ mockData: true }));
      act(() => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Call refetch — the hook should go loading again
      act(() => { result.current.refetch(); });
      expect(result.current.loading).toBe(true);

      act(() => { jest.advanceTimersByTime(1100); });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).not.toBeNull();
    });
  });
});
