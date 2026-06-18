import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { Logout as LogoutIcon, AccountCircle } from '@mui/icons-material';
import FormValidationExample from './components/FormValidationExample';
import DataVisualizationExample from './components/DataVisualizationExample';
import { AnalyticsDashboard } from './components';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import './components/FormValidation.css';

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
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardShell />
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
