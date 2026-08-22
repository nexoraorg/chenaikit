# chenaikit Frontend

The web app for chenaikit, built with React, TypeScript, and Vite.

## Development

```bash
pnpm install
pnpm run dev
```

## Testing

Component tests use [Vitest](https://vitest.dev) with
[React Testing Library](https://testing-library.com/react) and jsdom, and
assert on user-visible behavior (what's rendered, what happens on click)
rather than implementation details.

```bash
# Run all tests once
pnpm run test

# Watch mode
pnpm exec vitest
```

Test files live next to the code they cover (`Component.test.tsx`) and share
one setup file, `src/test/setup.ts`, wired in via the `test` block in
`vite.config.ts`.

Current coverage:

- `src/App.test.tsx` — navigation between the landing page and the
  dashboard.
- `src/pages/Dashboard.test.tsx` — dashboard states: sidebar nav groups and
  the active item, stat cards, and ledger table rows (including each status
  pill variant).
- `src/components/TopNav.test.tsx`, `LedgerRow.test.tsx`, `Stamp.test.tsx` —
  focused tests for the reusable components those pages are built from.

## Building

```bash
pnpm run build
```
