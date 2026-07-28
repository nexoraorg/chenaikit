import type { Components, Theme } from '@mui/material/styles';

const TOUCH_MIN = 44;

/**
 * Mobile-friendly MUI component defaults (touch targets, overflow).
 * Merged into light/dark themes alongside a11y overrides.
 */
export const mobileComponentOverrides: Components<Theme> = {
  MuiCssBaseline: {
    styleOverrides: {
      html: {
        overflowX: 'hidden',
      },
      body: {
        overflowX: 'hidden',
        maxWidth: '100vw',
      },
      '#root': {
        overflowX: 'hidden',
        maxWidth: '100vw',
        minHeight: '100vh',
      },
      img: {
        maxWidth: '100%',
        height: 'auto',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        [theme.breakpoints.down('md')]: {
          minHeight: TOUCH_MIN,
          paddingTop: theme.spacing(1.25),
          paddingBottom: theme.spacing(1.25),
        },
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        [theme.breakpoints.down('md')]: {
          minWidth: TOUCH_MIN,
          minHeight: TOUCH_MIN,
        },
      }),
    },
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        [theme.breakpoints.down('md')]: {
          minHeight: TOUCH_MIN,
          minWidth: 72,
        },
      }),
    },
  },
  MuiTableContainer: {
    styleOverrides: {
      root: {
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        [theme.breakpoints.down('md')]: {
          maxWidth: '85vw',
        },
      }),
    },
  },
};
