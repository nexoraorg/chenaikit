import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  AccountCircle,
  Assessment as AnalyticsIcon,
  Description as FormsIcon,
  ShowChart as VizIcon,
  Person as ProfileIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { MobileBottomNav, type DemoView } from './mobile';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

export type { DemoView };

const DEMO_TABS: Array<{ id: DemoView; label: string; icon: React.ReactNode }> = [
  { id: 'analytics', label: 'Analytics Dashboard', icon: <AnalyticsIcon /> },
  { id: 'forms', label: 'Forms', icon: <FormsIcon /> },
  { id: 'visualization', label: 'Sandbox', icon: <VizIcon /> },
];

export interface DashboardUser {
  email: string;
}

export interface DashboardProps {
  children: React.ReactNode;
  activeDemo: DemoView;
  onDemoChange: (view: DemoView) => void;
  user?: DashboardUser | null;
  onLogout?: () => void;
  /** Called on pull-to-refresh / explicit refresh shortcuts. */
  onRefresh?: () => void | Promise<void>;
}

/**
 * App chrome with hamburger drawer (mobile), desktop header tabs,
 * bottom navigation, and swipe-between-demo-views support.
 */
const Dashboard: React.FC<DashboardProps> = ({
  children,
  activeDemo,
  onDemoChange,
  user,
  onLogout,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const cycleDemo = useCallback(
    (direction: 'next' | 'prev') => {
      const index = DEMO_TABS.findIndex((t) => t.id === activeDemo);
      if (index < 0) return;
      const nextIndex =
        direction === 'next'
          ? (index + 1) % DEMO_TABS.length
          : (index - 1 + DEMO_TABS.length) % DEMO_TABS.length;
      onDemoChange(DEMO_TABS[nextIndex].id);
    },
    [activeDemo, onDemoChange]
  );

  const swipeHandlers = useSwipeGesture({
    onSwipe: (direction) => {
      if (!isMobile) return;
      if (direction === 'left') cycleDemo('next');
      if (direction === 'right') cycleDemo('prev');
    },
  });

  const closeDrawer = () => setDrawerOpen(false);

  const drawerContent = (
    <Box
      sx={{ width: 280, maxWidth: '85vw', height: '100%', display: 'flex', flexDirection: 'column' }}
      role="navigation"
      aria-label="Mobile menu"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          ChenaiKit
        </Typography>
        <IconButton onClick={closeDrawer} aria-label="Close menu" className="touch-target">
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />
      <List sx={{ flex: 1, py: 1 }}>
        {DEMO_TABS.map((tab) => (
          <ListItemButton
            key={tab.id}
            selected={activeDemo === tab.id}
            onClick={() => {
              onDemoChange(tab.id);
              navigate('/');
              closeDrawer();
            }}
            sx={{ minHeight: 48, px: 2.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{tab.icon}</ListItemIcon>
            <ListItemText primary={tab.label} />
          </ListItemButton>
        ))}
        <Divider sx={{ my: 1 }} />
        <ListItemButton
          component={RouterLink}
          to="/profile"
          onClick={closeDrawer}
          sx={{ minHeight: 48, px: 2.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <ProfileIcon />
          </ListItemIcon>
          <ListItemText primary="Profile" />
        </ListItemButton>
        <ListItemButton
          component={RouterLink}
          to="/settings"
          onClick={closeDrawer}
          sx={{ minHeight: 48, px: 2.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
      </List>
      {user && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <AccountCircle color="primary" />
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {user.email}
            </Typography>
            <ThemeToggle />
          </Box>
          {onLogout && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={() => {
                onLogout();
                closeDrawer();
              }}
              aria-label="Sign out of your account"
              sx={{ minHeight: 44, textTransform: 'none' }}
            >
              Sign Out
            </Button>
          )}
        </Box>
      )}
    </Box>
  );

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
          py: { xs: 2, md: 4 },
          px: { xs: 1.5, sm: 2.5 },
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {isMobile && (
          <IconButton
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="touch-target"
            sx={{
              position: 'absolute',
              top: 12,
              left: 8,
              color: 'white',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {user && !isMobile && (
          <Box
            sx={{
              position: 'absolute',
              top: 20,
              right: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ThemeToggle />
            <AccountCircle sx={{ color: '#38bdf8' }} aria-hidden="true" />
            <Typography variant="body2" component="span" sx={{ fontWeight: 500, color: '#e2e8f0' }}>
              {user.email}
            </Typography>
            {onLogout && (
              <Button
                variant="outlined"
                size="small"
                onClick={onLogout}
                startIcon={<LogoutIcon />}
                aria-label="Sign out of your account"
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  textTransform: 'none',
                  borderRadius: '8px',
                  minHeight: 40,
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                Sign Out
              </Button>
            )}
          </Box>
        )}

        {user && isMobile && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 8,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ThemeToggle />
          </Box>
        )}

        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            mb: 1,
            fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' },
            px: { xs: 5, md: 0 },
          }}
        >
          ChenaiKit - BI &amp; Analytics Dashboard
        </Typography>
        <Typography
          variant="h6"
          component="p"
          sx={{
            opacity: 0.9,
            mb: { xs: 1, md: 3 },
            fontWeight: 400,
            fontSize: { xs: '0.9rem', md: '1.25rem' },
            px: 1,
          }}
        >
          Advanced AI Insights &amp; Blockchain Monitoring
        </Typography>

        {/* Desktop tabs + shortcuts */}
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {DEMO_TABS.map((tab, index) => (
              <Button
                key={tab.id}
                variant={activeDemo === tab.id ? 'contained' : 'outlined'}
                onClick={() => onDemoChange(tab.id)}
                startIcon={tab.icon}
                id={`dashboard-tab-${index}`}
                aria-controls={`dashboard-panel-${tab.id}`}
                aria-selected={activeDemo === tab.id}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  textTransform: 'none',
                  borderRadius: '8px',
                  bgcolor: activeDemo === tab.id ? 'rgba(56, 189, 248, 0.35)' : 'transparent',
                  minHeight: 44,
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                {tab.label}
              </Button>
            ))}
          </Box>

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
                minHeight: 44,
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
                minHeight: 44,
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
              }}
            >
              Settings
            </Button>
          </Box>
        </Box>

        {isMobile && (
          <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
            Swipe left/right to switch views · Pull down to refresh
          </Typography>
        )}
      </Box>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        id="main-content"
        role="main"
        tabIndex={-1}
        aria-labelledby={`dashboard-tab-${DEMO_TABS.findIndex((t) => t.id === activeDemo)}`}
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchEnd={swipeHandlers.onTouchEnd}
        sx={{
          minHeight: 'calc(100vh - 160px)',
          pb: { xs: 'calc(64px + env(safe-area-inset-bottom, 0px))', md: 0 },
          overflowX: 'hidden',
          maxWidth: '100vw',
        }}
      >
        {children}
      </Box>

      <MobileBottomNav activeDemo={activeDemo} onDemoChange={onDemoChange} />

      <Box
        component="footer"
        sx={{
          bgcolor: 'grey.100',
          py: 2.5,
          px: 2,
          textAlign: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          typography: 'body2',
          display: { xs: 'none', md: 'block' },
        }}
      >
        Built with ChenaiKit - Advanced AI and Blockchain Solutions
      </Box>
    </div>
  );
};

export default Dashboard;
