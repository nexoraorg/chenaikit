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

export const radius = {
  /** 2px — small corners for buttons, chips, nested borders */
  sm: "2px",
  /** 3px — default card/panel/stamp rounding */
  md: "3px",
  /** 20px — pill-shaped badges and tags */
  pill: "20px",
  /** 50% — circular indicator dots */
  full: "50%",
} as const;

export const motion = {
  duration: {
    /** 100ms — micro-interactions (hover colour swap) */
    fast: "100ms",
    /** 200ms — standard button/link transitions */
    base: "200ms",
    /** 400ms — panel reveals, entrance animations */
    slow: "400ms",
  },
  easing: {
    /** Standard ease-out — most UI transitions */
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    /** Decelerate — elements entering the viewport */
    decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  },
} as const;
