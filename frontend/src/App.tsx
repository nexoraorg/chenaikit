import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { Logout as LogoutIcon, AccountCircle } from '@mui/icons-material';
import FormValidationExample from './components/FormValidationExample';
import DataVisualizationExample from './components/DataVisualizationExample';
import { AnalyticsDashboard } from './components';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import './components/FormValidation.css';

// Stub page components for policy/auth routes
const ForgotPasswordPage: React.FC = () => (
  <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
    <Box sx={{ maxWidth: 480, width: '100%', p: 4, borderRadius: 3, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', background: '#fff' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>Reset your password</Typography>
      <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>Enter your email address and we'll send you a password reset link.</Typography>
      <Typography variant="caption" sx={{ color: '#94a3b8' }}>Password reset functionality coming soon.</Typography>
    </Box>
  </Box>
);

const TermsPage: React.FC = () => (
  <Box sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, background: '#f8fafc' }}>
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: '#0f172a' }}>Terms of Service</Typography>
      <Typography variant="body1" sx={{ color: '#475569', lineHeight: 1.8 }}>
        These Terms of Service govern your use of ChenaiKit. By accessing or using our platform, you agree to be bound by these terms. Full terms documentation will be published here prior to production launch.
      </Typography>
    </Box>
  </Box>
);

const PrivacyPage: React.FC = () => (
  <Box sx={{ minHeight: '100vh', p: { xs: 3, md: 6 }, background: '#f8fafc' }}>
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: '#0f172a' }}>Privacy Policy</Typography>
      <Typography variant="body1" sx={{ color: '#475569', lineHeight: 1.8 }}>
        Your privacy is important to us. ChenaiKit collects only the data necessary to provide our services and never sells personal information to third parties. Full privacy policy documentation will be published here prior to production launch.
      </Typography>
    </Box>
  </Box>
);

const DashboardShell: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<'analytics' | 'forms' | 'visualization'>('analytics');
  const { user, logout } = useAuth();

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
            gap: 1.5,
            justifyContent: 'center',
            mb: { xs: 2, sm: 0 }
          }}>
            <AccountCircle sx={{ color: '#38bdf8' }} />
            <Typography variant="body2" sx={{ fontWeight: 500, color: '#e2e8f0' }}>
              {user.email}
            </Typography>
            <Button
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
            📈 Analytics Dashboard
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
            📝 Forms
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
            📊 Sandbox
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
            👤 Profile
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
            ⚙️ Settings
          </Link>
        </div>
      </header>
      
      <main style={{ minHeight: 'calc(100vh - 200px)' }}>
        {activeDemo === 'analytics' && <AnalyticsDashboard />}
        {activeDemo === 'forms' && <FormValidationExample />}
        {activeDemo === 'visualization' && <DataVisualizationExample />}
      </main>
      
      <footer style={{ 
        background: '#F9FAFB', 
        padding: '20px', 
        textAlign: 'center', 
        borderTop: '1px solid #E5E7EB' 
      }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>
          Built with ChenaiKit - Advanced AI and Blockchain Solutions
        </p>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
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
                    console.log('Profile updated');
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
                    console.log('Account updated');
                  }}
                  onDeleteAccount={async () => {
                    console.log('Account deleted');
                  }}
                  onUpdateNotificationPreferences={async () => {
                    console.log('Notification preferences updated');
                  }}
                  onChangePassword={async () => {
                    console.log('Password changed');
                  }}
                  onEnableTwoFactor={async () => {
                    console.log('2FA enabled');
                  }}
                  onDisableTwoFactor={async () => {
                    console.log('2FA disabled');
                  }}
                  onRevokeSession={async () => {
                    console.log('Session revoked');
                  }}
                  onRevokeAllSessions={async () => {
                    console.log('All sessions revoked');
                  }}
                  onCreateApiKey={async () => {
                    return { key: 'ck_' + Math.random().toString(36).substring(2) };
                  }}
                  onDeleteApiKey={async () => {
                    console.log('API key deleted');
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
    </AuthProvider>
  );
};

export default App;
