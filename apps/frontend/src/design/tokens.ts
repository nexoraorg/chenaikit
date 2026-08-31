// apps/frontend/src/design/tokens.ts
// chenaikit design system — "ledger" identity: pale accounting-paper
// backgrounds, ruled lines, and rubber-stamp status badges. Grounded in the
// product's own subject matter (credit decisions, fraud flags, verification)
// rather than a generic dashboard palette.
//
// Any surviving examples/* app should import from here instead of styling
// independently — see docs/architecture/design-system.md.

export const color = {
  paper: "#EAEFE2",
  paperDeep: "#DFE6D3",
  card: "#F3F6EC",
  rule: "#B9C4A9",
  ruleStrong: "#8E9C7C",
  ink: "#1E2B1E",
  inkSoft: "#4B5A45",
  inkFaint: "#7C8A73",
  stampRed: "#A23B32",
  stampBlue: "#2C4A63",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "40px",
} as const;

export const radius = {
  xs: "2px",
  sm: "3px",
  md: "4px",
  lg: "8px",
  full: "9999px",
} as const;

export const motion = {
  duration: {
    fast: "150ms",
    normal: "250ms",
    slow: "400ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
  },
} as const;

export const typography = {
  fontDisplay: "'JetBrains Mono', monospace",
  fontData: "'IBM Plex Mono', monospace",
  fontBody: "'Inter', system-ui, sans-serif",
  size: {
    sm: "13px",
    base: "15px",
    lg: "18px",
    xl: "24px",
  },
  weight: {
    regular: 400,
    medium: 500,
    bold: 700,
    black: 800,
  },
} as const;
