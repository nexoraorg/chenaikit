import React, { useState, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography, Tabs, Tab } from '@mui/material';
import { Logout as LogoutIcon, AccountCircle } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import FormValidationExample from './components/FormValidationExample';
import DataVisualizationExample from './components/DataVisualizationExample';
import { AnalyticsDashboard, LanguageSwitcher } from './components';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoadingProvider, useLoading } from './contexts/LoadingContext';
import { ErrorProvider } from './contexts/ErrorContext';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';
import ToastContainer from './components/ToastContainer';
import ThemeToggle from './components/ThemeToggle';
import useToast from './hooks/useToast';
import { requestSettingsApi } from './utils/settingsApi';
import './components/FormValidation.css';
import './styles/accessibility.css';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

type DemoView = 'analytics' | 'forms' | 'visualization';

const DEMO_TABS: Array<{ id: DemoView; label: string }> = [
  { id: 'analytics', label: 'Analytics Dashboard' },
  { id: 'forms', label: 'Forms' },
  { id: 'visualization', label: 'Sandbox' },
];

// Stub page components for policy/auth routes
const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 480, width: '100%', p: 4, borderRadius: 3, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', bgcolor: 'background.paper' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>{t('app.forgotPasswordTitle')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>{t('app.forgotPasswordDesc')}</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>{t('app.forgotPasswordSoon')}</Typography>
      </Box>
    </Box>
  );
};

const TermsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Box component="main" sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: 'text.primary' }}>{t('app.termsTitle')}</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
          {t('app.termsDesc')}
        </Typography>
      </Box>
    </Box>
  );
};

const PrivacyPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Box component="main" sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: 'text.primary' }}>{t('app.privacyTitle')}</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
          {t('app.privacyDesc')}
        </Typography>
      </Box>
    </Box>
  );
};

const DashboardShell: React.FC = () => {
  const { t } = useTranslation();
  const [activeDemo, setActiveDemo] = useState<'analytics' | 'forms' | 'visualization'>('analytics');
  const { user, logout } = useAuth();

  return (
    <div className="App">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Box
        component="header"
        sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
          color: 'white',
          py: 4,
          px: 2.5,
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {user && (
          <Box sx={{
            position: { xs: 'relative', sm: 'absolute' },
            top: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            justifyContent: 'center',
            mb: { xs: 2, sm: 0 }
          }}>
            <LanguageSwitcher 
              size="small" 
              compact 
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
                },
                '& .MuiSelect-select': {
                  color: 'white',
                },
                '& .MuiSelect-icon': {
                  color: 'rgba(255, 255, 255, 0.7)',
                }
              }}
            />
            <ThemeToggle />
            <AccountCircle sx={{ color: '#38bdf8' }} aria-hidden="true" />
            <Typography variant="body2" component="span" sx={{ fontWeight: 500, color: '#e2e8f0' }}>
              {user.email}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={logout}
              startIcon={<LogoutIcon />}
              aria-label="Sign out of your account"
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                textTransform: 'none',
                borderRadius: '8px',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              {t('app.signOut')}
            </Button>
          </Box>
        )}

        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
          {t('app.dashboardTitle')}
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '30px' }}>
          {t('app.dashboardSubtitle')}
        </p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveDemo('analytics')}
            style={{
              padding: '12px 24px',
              background: activeDemo === 'analytics' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
          >
            📈 {t('app.analyticsDashboard')}
          </button>
          <button
            onClick={() => setActiveDemo('forms')}
            style={{
              padding: '12px 24px',
              background: activeDemo === 'forms' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
          >
            📝 {t('app.forms')}
          </button>
          <button
            onClick={() => setActiveDemo('visualization')}
            style={{
              padding: '12px 24px',
              background: activeDemo === 'visualization' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
          >
            📊 {t('app.sandbox')}
          </button>
          <Link to="/profile" style={{
              padding: '12px 24px',
              background: 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}>
            👤 {t('app.profile')}
          </Link>
          <Link to="/settings" style={{
              padding: '12px 24px',
              background: 'transparent',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}>
            ⚙️ {t('app.settings')}
          </Link>
        </div>
      </Box>
      
      <main style={{ minHeight: 'calc(100vh - 200px)' }}>
        {activeDemo === 'analytics' && <AnalyticsDashboard />}
        {activeDemo === 'forms' && <FormValidationExample />}
        {activeDemo === 'visualization' && <DataVisualizationExample />}
      </main>
      
      <Box
        component="footer"
        sx={{
          bgcolor: 'grey.100',
          py: 2.5,
          textAlign: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          typography: 'body2',
        }}
      >
        {t('app.footer')}
      </Box>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { user: authUser } = useAuth();
  const { startLoading, stopLoading } = useLoading();
  const toast = useToast();

  const runSettingsRequest = useCallback(
    async <T,>(request: () => Promise<T>, successMessage?: string): Promise<T> => {
      startLoading();
      try {
        const result = await request();
        if (successMessage) {
          toast.success(successMessage);
        }
        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Request failed.';
        toast.error(message);
        throw error;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, toast]
  );

  const settingsUser = authUser
    ? {
        id: authUser.id,
        email: authUser.email,
        name: authUser.email.split('@')[0],
        role: authUser.role,
        language: 'en',
        theme: 'light' as const,
      }
    : {
        id: 1,
        email: 'user@example.com',
        name: 'Demo User',
        role: 'user',
        language: 'en',
        theme: 'light' as const,
      };

  const extractApiKey = (payload: unknown): string | undefined => {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.key === 'string') return record.key;
    if (typeof record.plainKey === 'string') return record.plainKey;
    if (record.data && typeof record.data === 'object') {
      const data = record.data as Record<string, unknown>;
      if (typeof data.key === 'string') return data.key;
      if (typeof data.plainKey === 'string') return data.plainKey;
    }

    return undefined;
  };

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner fullScreen message="Loading page" />}>
        <Routes>
          <Route path="/login" element={<ErrorBoundary name="Login page"><Login /></ErrorBoundary>} />
          <Route path="/signup" element={<ErrorBoundary name="Signup page"><Signup /></ErrorBoundary>} />
          <Route path="/forgot-password" element={<ErrorBoundary name="Password reset page"><ForgotPasswordPage /></ErrorBoundary>} />
          <Route path="/terms" element={<ErrorBoundary name="Terms page"><TermsPage /></ErrorBoundary>} />
          <Route path="/privacy" element={<ErrorBoundary name="Privacy page"><PrivacyPage /></ErrorBoundary>} />
          <Route
            path="/"
            element={
              <ErrorBoundary name="Dashboard page">
                <ProtectedRoute>
                  <DashboardShell />
                </ProtectedRoute>
              </ErrorBoundary>
            }
          />
          <Route
            path="/profile"
            element={
              <ErrorBoundary name="Profile page">
                <ProtectedRoute>
                  <Profile
                    user={{
                      id: 1,
                      email: 'user@example.com',
                      name: 'Demo User',
                      role: 'user'
                    }}
                    stats={{
                      transactions: 156,
                      score: 720,
                      activeDays: 45
                    }}
                    activity={[]}
                    onUpdateProfile={async () => {
                      // TODO: Integrate with backend API
                    }}
                  />
                </ProtectedRoute>
              </ErrorBoundary>
            }
          />
          <Route
            path="/settings"
            element={
              <ErrorBoundary name="Settings page">
                <ProtectedRoute>
                  <Settings
                    user={settingsUser}
                    notificationPreferences={{
                      emailNotifications: true,
                      pushNotifications: true,
                      transactionAlerts: true,
                      scoreChanges: true,
                      marketingEmails: false,
                      securityAlerts: true,
                      weeklyReport: false,
                      priceAlerts: true
                    }}
                    securitySettings={{
                      twoFactorEnabled: false,
                      sessions: [
                        {
                          id: '1',
                          device: 'Chrome on macOS',
                          location: 'San Francisco, CA',
                          lastActive: 'Just now',
                          current: true
                        }
                      ],
                      loginHistory: [
                        {
                          id: '1',
                          date: '2024-01-15 10:30 AM',
                          device: 'Chrome on macOS',
                          location: 'San Francisco, CA',
                          status: 'success'
                        }
                      ]
                    }}
                    apiKeys={[]}
                    onUpdateAccount={async (data) => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'put', url: '/api/v2/account/profile', data }),
                        'Profile updated successfully.'
                      );
                    }}
                    onDeleteAccount={async () => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'delete', url: '/api/v2/account/profile' }),
                        'Account deleted successfully.'
                      );
                    }}
                    onUpdateNotificationPreferences={async (data) => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'put', url: '/api/v2/account/notifications', data }),
                        'Notification preferences updated.'
                      );
                    }}
                    onChangePassword={async (currentPassword, newPassword) => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'put', url: '/api/v2/account/password', data: { currentPassword, newPassword } }),
                        'Password changed successfully.'
                      );
                    }}
                    onEnableTwoFactor={async () => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'post', url: '/api/v2/account/two-factor/enable' }),
                        'Two-factor authentication enabled.'
                      );
                    }}
                    onDisableTwoFactor={async () => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'post', url: '/api/v2/account/two-factor/disable' }),
                        'Two-factor authentication disabled.'
                      );
                    }}
                    onRevokeSession={async (sessionId) => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'delete', url: `/api/v2/account/sessions/${sessionId}` }),
                        'Session revoked.'
                      );
                    }}
                    onRevokeAllSessions={async () => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'delete', url: '/api/v2/account/sessions' }),
                        'All sessions revoked.'
                      );
                    }}
                    onCreateApiKey={async (name, permissions) => {
                      const response = await runSettingsRequest(
                        () => requestSettingsApi({ method: 'post', url: '/api/v2/account/api-keys', data: { name, permissions } }),
                        'API key created.'
                      );
                      const key = extractApiKey(response);
                      if (!key) {
                        throw new Error('The server did not return a new API key.');
                      }
                      return { key };
                    }}
                    onDeleteApiKey={async (id) => {
                      await runSettingsRequest(
                        () => requestSettingsApi({ method: 'delete', url: `/api/v2/account/api-keys/${id}` }),
                        'API key deleted.'
                      );
                    }}
                    onRegenerateApiKey={async (id) => {
                      const response = await runSettingsRequest(
                        () => requestSettingsApi({ method: 'put', url: `/api/v2/account/api-keys/${id}/regenerate` }),
                        'API key regenerated.'
                      );
                      const key = extractApiKey(response);
                      if (!key) {
                        throw new Error('The server did not return a regenerated API key.');
                      }
                      return { key };
                    }}
                  />
                </ProtectedRoute>
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LoadingProvider>
        <ToastProvider>
          <ErrorProvider>
            <ErrorBoundary name="Root application" fallbackTitle="ChenaiKit could not render">
              <AuthProvider>
                <AppRoutes />
                <ToastContainer />
              </AuthProvider>
            </ErrorBoundary>
          </ErrorProvider>
        </ToastProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
};

export default App;
