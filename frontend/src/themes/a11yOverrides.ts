import type { Components, Theme } from '@mui/material/styles';

const focusRing = (theme: Theme) => ({
  outline: '2px solid',
  outlineColor: theme.palette.primary.main,
  outlineOffset: 2,
});

export const a11yComponentOverrides: Components<Theme> = {
  MuiButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&:focus-visible': focusRing(theme),
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&:focus-visible': focusRing(theme),
      }),
    },
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&:focus-visible': focusRing(theme),
      }),
    },
  },
  MuiLink: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&:focus-visible': focusRing(theme),
      }),
    },
  },
  MuiChip: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&:focus-visible': focusRing(theme),
      }),
    },
  },
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        transition: 'background-color 0.3s ease, color 0.3s ease',
      },
      '#root': {
        minHeight: '100vh',
      },
    },
  },
};
