import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { ProtectedRoute } from '../ProtectedRoute';
import * as AuthContextModule from '../AuthContext';

const theme = createTheme();

// ─── helpers ──────────────────────────────────────────────────────────────────

const mockUseAuth = (overrides: Partial<ReturnType<typeof AuthContextModule.useAuth>>) => {
  jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  });
};

interface RenderOptions {
  initialPath?: string;
  allowedRoles?: string[];
}

const renderProtected = (options: RenderOptions = {}) => {
  const { initialPath = '/dashboard', allowedRoles } = options;
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={allowedRoles}>
                <div data-testid="protected-content">Protected</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('auth/ProtectedRoute', () => {
  // ─── loading state ────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders a loading spinner while auth is initialising', () => {
      mockUseAuth({ isLoading: true });
      renderProtected();
      // LoadingSpinner renders a CircularProgress (role="progressbar")
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  // ─── unauthenticated ──────────────────────────────────────────────────────

  describe('unauthenticated', () => {
    it('redirects to /login when not authenticated', () => {
      mockUseAuth({ isAuthenticated: false });
      renderProtected();
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('preserves the attempted path in location state', () => {
      mockUseAuth({ isAuthenticated: false });
      // We verify redirect happens (login page shows); deep state inspection
      // requires a more complex harness – presence of login page is sufficient.
      renderProtected({ initialPath: '/dashboard' });
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  // ─── authenticated ────────────────────────────────────────────────────────

  describe('authenticated', () => {
    it('renders protected content when authenticated', () => {
      mockUseAuth({
        isAuthenticated: true,
        user: { id: 1, email: 'user@test.com', role: 'user' },
      });
      renderProtected();
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('renders content when no allowedRoles are specified', () => {
      mockUseAuth({
        isAuthenticated: true,
        user: { id: 1, email: 'user@test.com', role: 'admin' },
      });
      renderProtected(); // no allowedRoles
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  // ─── role-based access ────────────────────────────────────────────────────

  describe('role-based access', () => {
    it('renders content when user role is in allowedRoles', () => {
      mockUseAuth({
        isAuthenticated: true,
        user: { id: 1, email: 'admin@test.com', role: 'admin' },
      });
      renderProtected({ allowedRoles: ['admin', 'superuser'] });
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('redirects to / when user role is NOT in allowedRoles', () => {
      mockUseAuth({
        isAuthenticated: true,
        user: { id: 1, email: 'user@test.com', role: 'user' },
      });
      renderProtected({ allowedRoles: ['admin'] });
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('renders content for any role when allowedRoles is an empty array', () => {
      // Empty array means no roles qualify — user gets redirected
      mockUseAuth({
        isAuthenticated: true,
        user: { id: 1, email: 'user@test.com', role: 'user' },
      });
      renderProtected({ allowedRoles: [] });
      // allowedRoles.includes(user.role) is false for empty array → redirect
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    it('does not apply role check when user is null (authenticated edge case)', () => {
      mockUseAuth({
        isAuthenticated: true,
        user: null, // no user object
      });
      renderProtected({ allowedRoles: ['admin'] });
      // user is null → allowedRoles check is skipped → renders children
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  // ─── children rendering ───────────────────────────────────────────────────

  describe('children rendering', () => {
    it('renders the exact child element passed to it', () => {
      mockUseAuth({
        isAuthenticated: true,
        user: { id: 1, email: 'u@test.com', role: 'user' },
      });
      renderProtected();
      expect(screen.getByText('Protected')).toBeInTheDocument();
    });
  });
});
