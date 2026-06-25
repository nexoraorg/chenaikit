import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { DarkMode, LightMode } from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeContext';
import { useShortcutLabel } from '../hooks/useKeyboardShortcuts';

export const ThemeToggle: React.FC = () => {
  const { mode, toggleTheme } = useThemeMode();
  const shortcutLabel = useShortcutLabel('action.theme.toggle');

  return (
    <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode (${shortcutLabel})`}>
      <IconButton
        aria-keyshortcuts={shortcutLabel}
        onClick={toggleTheme}
        sx={{
          color: 'rgba(255,255,255,0.8)',
          '&:hover': {
            color: 'white',
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
        }}
      >
        {mode === 'light' ? <DarkMode /> : <LightMode />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
