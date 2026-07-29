import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { LoginForm } from '../LoginForm';
import * as AuthContextModule from '../AuthContext';

const theme = createTheme();

// ─── mocks ────────────────────────────────────────────────────────────────────

// Mock @chenaikit/core ValidationRules used by useFormValidation in the form
jest.mock('@chenaikit/core', () => ({
  ValidationRules: {
    email: jest.fn(() => ({})),
    required: jest.fn(() => ({})),
  },
  validateField: jest.fn().mockResolvedValue(null),
  validateFields: jest.fn().mockResolvedValue({}),
}));

// Mock react-router-dom's useNavigate and useLocation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null, pathname: '/login' }),
}));

const mockLogin = jest.fn();

const mockUseAuth = (overrides: Partial<ReturnType<typeof AuthContextModule.useAuth>> = {}) => {
  jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: mockLogin,
    register: jest.fn(),
    logout: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  });
};

// ─── render helper ────────────────────────────────────────────────────────────

const renderForm = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    </ThemeProvider>
  );

beforeEach(() => {
  mockLogin.mockReset();
  mockUseAuth();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('auth/LoginForm', () => {
  // ─── rendering ────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the welcome heading', () => {
      renderForm();
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });

    it('renders email and password fields', () => {
      renderForm();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it('renders the Sign In submit button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('renders "Remember me" checkbox', () => {
      renderForm();
      expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    });

    it('renders "Forgot password?" link', () => {
      renderForm();
      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
    });

    it('renders social login buttons (Google and GitHub)', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument();
    });

    it('renders the sign-up link', () => {
      renderForm();
      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
    });
  });

  // ─── password visibility toggle ───────────────────────────────────────────

  describe('password visibility toggle', () => {
    it('password field is hidden by default', () => {
      renderForm();
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    });

    it('toggles password visibility when the icon button is clicked', async () => {
      renderForm();
      const toggleBtn = screen.getByRole('button', { name: /toggle password visibility/i });
      await userEvent.click(toggleBtn);
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text');
      await userEvent.click(toggleBtn);
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    });
  });

  // ─── remember me checkbox ─────────────────────────────────────────────────

  describe('remember me', () => {
    it('is unchecked by default', () => {
      renderForm();
      expect(screen.getByLabelText(/remember me/i)).not.toBeChecked();
    });

    it('can be checked and unchecked', async () => {
      renderForm();
      const checkbox = screen.getByLabelText(/remember me/i);
      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      await userEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  // ─── form submission ──────────────────────────────────────────────────────

  describe('form submission', () => {
    it('calls login with email, password, and rememberMe=false by default', async () => {
      mockLogin.mockResolvedValueOnce(undefined);
      renderForm();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'password123', false);
      });
    });

    it('calls login with rememberMe=true when checkbox is checked', async () => {
      mockLogin.mockResolvedValueOnce(undefined);
      renderForm();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.click(screen.getByLabelText(/remember me/i));

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'password123', true);
      });
    });

    it('navigates to "/" on successful login', async () => {
      mockLogin.mockResolvedValueOnce(undefined);
      renderForm();

      await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'pass');

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    });

    it('shows a submit error message when login throws', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
      renderForm();

      await userEvent.type(screen.getByLabelText(/email address/i), 'bad@test.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpass');

      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i);
      });
    });
  });

  // ─── field updates ────────────────────────────────────────────────────────

  describe('field interaction', () => {
    it('updates email field value as user types', async () => {
      renderForm();
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'hello@world.com');
      expect(emailInput).toHaveValue('hello@world.com');
    });

    it('updates password field value as user types', async () => {
      renderForm();
      const pwInput = screen.getByLabelText(/^password$/i);
      await userEvent.type(pwInput, 'secret');
      expect(pwInput).toHaveValue('secret');
    });
  });
});
