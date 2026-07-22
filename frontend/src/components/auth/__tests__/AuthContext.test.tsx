import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider, useAuth } from '../AuthContext';

// ─── mock axios ───────────────────────────────────────────────────────────────
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Minimal valid JWT payloads (base64-encoded JSON) – not cryptographically signed,
// but sufficient for the JWT decoder inside AuthContext.
const makeJwt = (payload: object): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

const validAccessToken = makeJwt({
  id: 1,
  email: 'user@test.com',
  role: 'user',
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
});

const validRefreshToken = 'refresh-token-abc';

// Set up default interceptors mock — AuthContext uses axios.interceptors
beforeEach(() => {
  // Reset storage before every test to prevent order-dependent state leakage
  window.localStorage.clear();
  window.sessionStorage.clear();

  mockedAxios.interceptors = {
    request: { use: jest.fn(() => 0), eject: jest.fn() },
    response: { use: jest.fn(() => 0), eject: jest.fn() },
  } as any;
  mockedAxios.post = jest.fn();
});

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('auth/AuthContext', () => {
  // ─── useAuth outside provider ─────────────────────────────────────────────

  describe('useAuth', () => {
    it('throws when used outside AuthProvider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useAuth())).toThrow();
      spy.mockRestore();
    });
  });

  // ─── initial state (no stored token) ─────────────────────────────────────

  describe('initial state — no stored token', () => {
    it('starts loading while checking for a refresh token', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      // isLoading starts true while the async init runs
      expect(result.current.isLoading).toBe(true);
    });

    it('finishes with isAuthenticated=false when there is no stored token', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('exposes login, register, logout, clearError functions', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.register).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  // ─── login() ─────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('sets user and isAuthenticated on successful login', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: validAccessToken, refreshToken: validRefreshToken },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('user@test.com', 'password', false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('user@test.com');
      expect(result.current.user?.role).toBe('user');
      expect(result.current.error).toBeNull();
    });

    it('stores refresh token in sessionStorage when rememberMe=false', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: validAccessToken, refreshToken: validRefreshToken },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        await result.current.login('user@test.com', 'password', false);
      });

      expect(window.sessionStorage.getItem('chenaikit_refresh_token')).toBe(validRefreshToken);
      expect(window.localStorage.getItem('chenaikit_refresh_token')).toBeNull();
    });

    it('stores refresh token in localStorage when rememberMe=true', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: validAccessToken, refreshToken: validRefreshToken },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        await result.current.login('user@test.com', 'password', true);
      });

      expect(window.localStorage.getItem('chenaikit_refresh_token')).toBe(validRefreshToken);
    });

    it('sets error and throws on login failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: 'Invalid credentials' } },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await expect(
          result.current.login('bad@test.com', 'wrong', false)
        ).rejects.toThrow('Invalid credentials');
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });

    it('uses a fallback error message when server provides none', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await expect(
          result.current.login('u@test.com', 'p', false)
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  // ─── logout() ────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('clears user and isAuthenticated', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: validAccessToken, refreshToken: validRefreshToken },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        await result.current.login('user@test.com', 'password', false);
      });
      expect(result.current.isAuthenticated).toBe(true);

      act(() => { result.current.logout(); });
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
    });

    it('removes tokens from storage on logout', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: validAccessToken, refreshToken: validRefreshToken },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        await result.current.login('user@test.com', 'password', true);
      });
      act(() => { result.current.logout(); });

      expect(window.localStorage.getItem('chenaikit_refresh_token')).toBeNull();
      expect(window.sessionStorage.getItem('chenaikit_refresh_token')).toBeNull();
    });
  });

  // ─── register() ──────────────────────────────────────────────────────────

  describe('register()', () => {
    it('resolves without error on successful registration', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await expect(
          result.current.register('new@test.com', 'Password1!')
        ).resolves.not.toThrow();
      });
    });

    it('sets error and throws on registration failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: 'Email already in use' } },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await expect(
          result.current.register('existing@test.com', 'Password1!')
        ).rejects.toThrow('Email already in use');
      });

      expect(result.current.error).toBe('Email already in use');
    });
  });

  // ─── clearError() ────────────────────────────────────────────────────────

  describe('clearError()', () => {
    it('resets the error to null', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: 'Bad creds' } },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('u@test.com', 'p', false).catch(() => {});
      });
      expect(result.current.error).toBeTruthy();

      act(() => { result.current.clearError(); });
      expect(result.current.error).toBeNull();
    });
  });

  // ─── session restore on mount ─────────────────────────────────────────────

  describe('session restore', () => {
    it('restores a session when a refresh token is stored in localStorage', async () => {
      // Seed storage before mounting
      window.localStorage.setItem('chenaikit_refresh_token', 'stored-refresh');
      window.localStorage.setItem('chenaikit_remember_me', 'true');

      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: validAccessToken, refreshToken: 'new-refresh' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('user@test.com');
    });

    it('stays unauthenticated when refresh fails during restore', async () => {
      window.localStorage.setItem('chenaikit_refresh_token', 'bad-token');
      mockedAxios.post.mockRejectedValueOnce(new Error('Token expired'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
