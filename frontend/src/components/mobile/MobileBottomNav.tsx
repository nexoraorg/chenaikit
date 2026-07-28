import React from 'react';
import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import {
  Assessment as AnalyticsIcon,
  Description as FormsIcon,
  ShowChart as VizIcon,
  Person as ProfileIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

export type DemoView = 'analytics' | 'forms' | 'visualization';

export interface MobileBottomNavProps {
  activeDemo?: DemoView;
  onDemoChange?: (view: DemoView) => void;
}

type NavValue = DemoView | 'profile' | 'settings';

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeDemo = 'analytics',
  onDemoChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const value: NavValue =
    location.pathname.startsWith('/profile')
      ? 'profile'
      : location.pathname.startsWith('/settings')
        ? 'settings'
        : activeDemo;

  const handleChange = (_: React.SyntheticEvent, next: NavValue) => {
    if (next === 'profile') {
      navigate('/profile');
      return;
    }
    if (next === 'settings') {
      navigate('/settings');
      return;
    }
    if (location.pathname !== '/') {
      navigate('/', { state: { activeDemo: next } });
    }
    onDemoChange?.(next);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderRadius: 0,
        pb: 'env(safe-area-inset-bottom, 0px)',
        display: { xs: 'block', md: 'none' },
      }}
    >
      <BottomNavigation
        value={value}
        onChange={handleChange}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            px: 0.5,
            py: 0.5,
            minHeight: 44,
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.65rem',
          },
        }}
      >
        <BottomNavigationAction
          label="Analytics"
          value="analytics"
          icon={<AnalyticsIcon />}
          aria-label="Analytics dashboard"
        />
        <BottomNavigationAction
          label="Forms"
          value="forms"
          icon={<FormsIcon />}
          aria-label="Forms demo"
        />
        <BottomNavigationAction
          label="Sandbox"
          value="visualization"
          icon={<VizIcon />}
          aria-label="Visualization sandbox"
        />
        <BottomNavigationAction
          label="Profile"
          value="profile"
          icon={<ProfileIcon />}
          aria-label="Profile"
        />
        <BottomNavigationAction
          label="Settings"
          value="settings"
          icon={<SettingsIcon />}
          aria-label="Settings"
        />
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNav;
