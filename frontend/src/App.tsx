import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography, Tabs, Tab } from '@mui/material';
import { Logout as LogoutIcon, AccountCircle } from '@mui/icons-material';
import FormValidationExample from './components/FormValidationExample';
import DataVisualizationExample from './components/DataVisualizationExample';
import { AnalyticsDashboard } from './components';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { LoadingSpinner } from './components/LoadingSpinner';
import ToastContainer from './components/ToastContainer';
import ThemeToggle from './components/ThemeToggle';
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
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'background.default' }}>
      <Box component="main" sx={{ maxWidth: 480, width: '100%', p: 4, borderRadius: 3, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', bgcolor: 'background.paper' }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>Reset your password</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>Enter your email address and we'll send you a password reset link.</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Password reset functionality coming soon.</Typography>
      </Box>
    </Box>
  );
};

const TermsPage: React.FC = () => {
  return (
    <Box component="main" sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 3, color: 'text.primary' }}>Terms of Service</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
          These Terms of Service govern your use of ChenaiKit. By accessing or using our platform, you agree to be bound by these terms. Full terms documentation will be published here prior to production launch.
        </Typography>
      </Box>
    </Box>
  );
};

const PrivacyPage: React.FC = () => {
  return (
    <Box component="main" sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 3, color: 'text.primary' }}>Privacy Policy</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
          Your privacy is important to us. ChenaiKit collects only the data necessary to provide our services and never sells personal information to third parties. Full privacy policy documentation will be published here prior to production launch.
        </Typography>
      </Box>
    </Box>
  );
};

const DashboardShell: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<DemoView>('analytics');
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
            mb: { xs: 2, sm: 0 },
          }}
          >
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
              Sign Out
            </Button>
          </Box>
        )}

        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          ChenaiKit - BI &amp; Analytics Dashboard
        </Typography>
        <Typography variant="h6" component="p" sx={{ opacity: 0.9, mb: 3, fontWeight: 400 }}>
          Advanced AI Insights &amp; Blockchain Monitoring
        </Typography>

        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        >
          <Tabs
            value={activeDemo}
            onChange={(_, value: DemoView) => setActiveDemo(value)}
            aria-label="Dashboard views"
            textColor="inherit"
            indicatorColor="secondary"
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.75)',
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 48,
              },
              '& .Mui-selected': { color: '#ffffff' },
              '& .MuiTabs-indicator': { backgroundColor: '#38bdf8' },
            }}
          >
            {DEMO_TABS.map((tab, index) => (
              <Tab
                key={tab.id}
                value={tab.id}
                label={tab.label}
                id={`dashboard-tab-${index}`}
                aria-controls={`dashboard-panel-${tab.id}`}
              />
            ))}
          </Tabs>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              component={RouterLink}
              to="/profile"
              variant="outlined"
              aria-label="Open profile page"
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                textTransform: 'none',
                borderRadius: '8px',
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
              }}
            >
              Profile
            </Button>
            <Button
              component={RouterLink}
              to="/settings"
              variant="outlined"
              aria-label="Open settings page"
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                textTransform: 'none',
                borderRadius: '8px',
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
              }}
            >
              Settings
            </Button>
          </Box>
        </Box>
      </Box>

      <Box
        component="main"
        id="main-content"
        role="main"
        tabIndex={-1}
        aria-labelledby={`dashboard-tab-${DEMO_TABS.findIndex((t) => t.id === activeDemo)}`}
        sx={{ minHeight: 'calc(100vh - 200px)' }}
      >
        <Suspense fallback={<LoadingSpinner fullScreen message="Loading dashboard content" />}>
          {DEMO_TABS.map((tab, index) => (
            <Box
              key={tab.id}
              id={`dashboard-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`dashboard-tab-${index}`}
              hidden={activeDemo !== tab.id}
            >
              {tab.id === 'analytics' && <AnalyticsDashboard />}
              {tab.id === 'forms' && <FormValidationExample />}
              {tab.id === 'visualization' && <DataVisualizationExample />}
            </Box>
          ))}
        </Suspense>
      </Box>

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
        </BrowserRouter>
        <ToastContainer />
      </AuthProvider>
      </ToastProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
};

export default App;
