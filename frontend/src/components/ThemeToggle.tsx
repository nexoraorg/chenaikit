import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { DarkMode, LightMode } from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { mode, toggleTheme } = useThemeMode();
  const nextMode = mode === 'light' ? 'dark' : 'light';

  return (
    <Tooltip title={`Switch to ${nextMode} mode (Ctrl+D)`}>
      <IconButton
        onClick={toggleTheme}
        aria-label={`Switch to ${nextMode} mode`}
        aria-pressed={mode === 'dark'}
        sx={{
          color: 'rgba(255,255,255,0.8)',
          '&:hover': {
            color: 'white',
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
        }}
      >
        {mode === 'light' ? <DarkMode aria-hidden="true" /> : <LightMode aria-hidden="true" />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
