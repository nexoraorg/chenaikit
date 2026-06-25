import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import { Logout as LogoutIcon, AccountCircle } from '@mui/icons-material';
import FormValidationExample from './components/FormValidationExample';
import DataVisualizationExample from './components/DataVisualizationExample';
import { AnalyticsDashboard } from './components';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { ShortcutProvider, useShortcutContext } from './contexts/ShortcutContext';
import { LoadingSpinner } from './components/LoadingSpinner';
import ToastContainer from './components/ToastContainer';
import ThemeToggle from './components/ThemeToggle';
import ShortcutHelp, { ShortcutFeedback } from './components/ShortcutHelp';
import { useKeyboardShortcut, useShortcutLabel } from './hooks/useKeyboardShortcuts';
import { getDefaultShortcut } from './shortcuts';
import './components/FormValidation.css';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

// Stub page components for policy/auth routes
const ForgotPasswordPage: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 480, width: '100%', p: 4, borderRadius: 3, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', bgcolor: 'background.paper' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>Reset your password</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>Enter your email address and we'll send you a password reset link.</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Password reset functionality coming soon.</Typography>
      </Box>
    </Box>
  );
};

const TermsPage: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: 'text.primary' }}>Terms of Service</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
          These Terms of Service govern your use of ChenaiKit. By accessing or using our platform, you agree to be bound by these terms. Full terms documentation will be published here prior to production launch.
        </Typography>
      </Box>
    </Box>
  );
};

const PrivacyPage: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: 'text.primary' }}>Privacy Policy</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
          Your privacy is important to us. ChenaiKit collects only the data necessary to provide our services and never sells personal information to third parties. Full privacy policy documentation will be published here prior to production launch.
        </Typography>
      </Box>
    </Box>
  );
};

const getShortcut = (id: Parameters<typeof getDefaultShortcut>[0]) => {
  const shortcut = getDefaultShortcut(id);
  if (!shortcut) {
    throw new Error(`Missing shortcut definition: ${id}`);
  }
  return shortcut;
};

const AppShortcutController: React.FC = () => {
  const navigate = useNavigate();
  const { openHelp } = useShortcutContext();
  const { toggleTheme } = useThemeMode();
  const { user, logout } = useAuth();
  const toast = useToastContext();

  useKeyboardShortcut(getShortcut('help.open'), () => openHelp());
  useKeyboardShortcut(getShortcut('settings.shortcuts'), () => openHelp());
  useKeyboardShortcut(getShortcut('navigation.dashboard'), () => navigate('/'));
  useKeyboardShortcut(getShortcut('navigation.profile'), () => navigate('/profile'));
  useKeyboardShortcut(getShortcut('navigation.settings'), () => navigate('/settings'));
  useKeyboardShortcut(getShortcut('action.theme.toggle'), () => toggleTheme());
  useKeyboardShortcut(
    getShortcut('action.signout'),
    () => {
      if (user) logout();
    },
    { enabled: Boolean(user) }
  );
  useKeyboardShortcut(getShortcut('search.focus'), () => {
    const searchTarget = document.querySelector<HTMLElement>(
      '[data-shortcut-search="true"], input[type="search"], input[aria-label*="search" i], input[placeholder*="search" i]'
    );

    if (searchTarget) {
      searchTarget.focus();
      return;
    }

    toast.info('No search field is available on this view.', { duration: 1800 });
  });

  return null;
};

const DashboardShell: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<'analytics' | 'forms' | 'visualization'>('analytics');
  const { user, logout } = useAuth();
  const analyticsShortcut = useShortcutLabel('dashboard.analytics');
  const formsShortcut = useShortcutLabel('dashboard.forms');
  const visualizationShortcut = useShortcutLabel('dashboard.visualization');
  const profileShortcut = useShortcutLabel('navigation.profile');
  const settingsShortcut = useShortcutLabel('navigation.settings');
  const signoutShortcut = useShortcutLabel('action.signout');

  useKeyboardShortcut(getShortcut('dashboard.analytics'), () => setActiveDemo('analytics'));
  useKeyboardShortcut(getShortcut('dashboard.forms'), () => setActiveDemo('forms'));
  useKeyboardShortcut(getShortcut('dashboard.visualization'), () => setActiveDemo('visualization'));

  return (
    <div className="App">
      <header style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
        color: 'white',
        padding: '30px 20px',
        textAlign: 'center',
        position: 'relative'
      }}>
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
            <ThemeToggle />
            <AccountCircle sx={{ color: '#38bdf8' }} />
            <Typography variant="body2" sx={{ fontWeight: 500, color: '#e2e8f0' }}>
              {user.email}
            </Typography>
            <Tooltip title={`Sign out (${signoutShortcut})`}>
              <Button
                aria-keyshortcuts={signoutShortcut}
                variant="outlined"
                size="small"
                onClick={logout}
                startIcon={<LogoutIcon />}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  textTransform: 'none',
                  borderRadius: '8px',
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  }
                }}
              >
                Sign Out
              </Button>
            </Tooltip>
          </Box>
        )}

        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
          ChenaiKit - BI & Analytics Dashboard
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '30px' }}>
          Advanced AI Insights & Blockchain Monitoring
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveDemo('analytics')}
            aria-keyshortcuts={analyticsShortcut}
            title={`Analytics dashboard (${analyticsShortcut})`}
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
            📈 Analytics Dashboard ({analyticsShortcut})
          </button>
          <button
            onClick={() => setActiveDemo('forms')}
            aria-keyshortcuts={formsShortcut}
            title={`Forms (${formsShortcut})`}
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
            📝 Forms ({formsShortcut})
          </button>
          <button
            onClick={() => setActiveDemo('visualization')}
            aria-keyshortcuts={visualizationShortcut}
            title={`Sandbox (${visualizationShortcut})`}
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
            📊 Sandbox ({visualizationShortcut})
          </button>
          <Link to="/profile" aria-keyshortcuts={profileShortcut} title={`Profile (${profileShortcut})`} style={{
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
            👤 Profile ({profileShortcut})
          </Link>
          <Link to="/settings" aria-keyshortcuts={settingsShortcut} title={`Settings (${settingsShortcut})`} style={{
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
            ⚙️ Settings ({settingsShortcut})
          </Link>
        </div>
      </header>

      <main style={{ minHeight: 'calc(100vh - 200px)' }}>
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          {activeDemo === 'analytics' && <AnalyticsDashboard />}
          {activeDemo === 'forms' && <FormValidationExample />}
          {activeDemo === 'visualization' && <DataVisualizationExample />}
        </Suspense>
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
        Built with ChenaiKit - Advanced AI and Blockchain Solutions
      </Box>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LoadingProvider>
      <ToastProvider>
        <AuthProvider>
        <BrowserRouter>
        <ShortcutProvider>
          <AppShortcutController />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardShell />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
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
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings
                    user={{
                      id: 1,
                      email: 'user@example.com',
                      name: 'Demo User',
                      role: 'user',
                      language: 'en',
                      theme: 'light'
                    }}
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
                    onUpdateAccount={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onDeleteAccount={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onUpdateNotificationPreferences={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onChangePassword={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onEnableTwoFactor={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onDisableTwoFactor={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onRevokeSession={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onRevokeAllSessions={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onCreateApiKey={async () => {
                      return { key: 'ck_' + Math.random().toString(36).substring(2) };
                    }}
                    onDeleteApiKey={async () => {
                      // TODO: Integrate with backend API
                    }}
                    onRegenerateApiKey={async () => {
                      return { key: 'ck_' + Math.random().toString(36).substring(2) };
                    }}
                  />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ShortcutHelp />
          <ShortcutFeedback />
        </ShortcutProvider>
        </BrowserRouter>
        <ToastContainer />
      </AuthProvider>
      </ToastProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
};

export default App;
