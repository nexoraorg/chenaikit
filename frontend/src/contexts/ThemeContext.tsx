import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { lightTheme } from '../themes/lightTheme';
import { darkTheme } from '../themes/darkTheme';
import { useTranslation } from 'react-i18next';
import { getLanguageDirection } from '../i18n/config';


type ThemeMode = 'light' | 'dark';
type UserPreference = ThemeMode | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  userPreference: UserPreference;
  setTheme: (preference: UserPreference) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'chenaikit_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemPreference = (): ThemeMode => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

function getInitialPreference(): UserPreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return 'system';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userPreference, setUserPreference] = useState<UserPreference>(getInitialPreference);
  const [systemPreference, setSystemPreference] = useState<ThemeMode>(getSystemPreference);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPreference(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, userPreference);
    } catch {
      // localStorage not available
    }
  }, [userPreference]);

  const mode = userPreference === 'system' ? systemPreference : userPreference;

  const setTheme = useCallback((preference: UserPreference) => {
    setUserPreference(preference);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = mode === 'light' ? 'dark' : 'light';
    setUserPreference(next);
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTheme]);

  const { i18n } = useTranslation();
  const activeDirection = getLanguageDirection(i18n.language);

  const activeTheme = useMemo(() => {
    const baseTheme = mode === 'light' ? lightTheme : darkTheme;
    return createTheme(baseTheme, { direction: activeDirection });
  }, [mode, activeDirection]);

  const contextValue = useMemo(() => ({ mode, userPreference, setTheme, toggleTheme }), [mode, userPreference, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={activeTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};
