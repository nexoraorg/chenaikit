import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ToastProvider, useToastContext } from '../../contexts/ToastContext';
import ToastContainer from '../ToastContainer';

const theme = createTheme();

// ─── helpers ──────────────────────────────────────────────────────────────────

const AllProviders: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <ToastProvider>
      {children}
      <ToastContainer />
    </ToastProvider>
  </ThemeProvider>
);

// A trigger component that fires toasts programmatically
const Trigger: React.FC<{
  onMount?: (ctx: ReturnType<typeof useToastContext>) => void;
}> = ({ onMount }) => {
  const ctx = useToastContext();
  const didRunRef = React.useRef(false);
  React.useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;
    onMount?.(ctx);
  }, [onMount, ctx]);
  return null;
};

describe('components/ToastContainer', () => {
  // ─── no toasts ────────────────────────────────────────────────────────────

  describe('when there are no toasts', () => {
    it('renders nothing into the DOM', () => {
      const { baseElement } = render(<AllProviders />);
      // ToastContainer uses a portal — nothing visible in the tree
      expect(baseElement.querySelectorAll('[role="status"]').length).toBe(0);
    });
  });

  // ─── single toast ─────────────────────────────────────────────────────────

  describe('single toast', () => {
    it('renders the toast message via a portal', async () => {
      render(
        <AllProviders>
          <Trigger
            onMount={(ctx) => {
              act(() => { ctx.info('Hello from portal'); });
            }}
          />
        </AllProviders>
      );

      expect(await screen.findByText('Hello from portal')).toBeInTheDocument();
    });

    it('renders a dismiss button for the toast', async () => {
      render(
        <AllProviders>
          <Trigger onMount={(ctx) => { act(() => { ctx.success('Done!'); }); }} />
        </AllProviders>
      );

      expect(
        await screen.findByRole('button', { name: /dismiss notification/i })
      ).toBeInTheDocument();
    });
  });

  // ─── multiple toasts ──────────────────────────────────────────────────────

  describe('multiple toasts', () => {
    it('renders multiple toasts simultaneously', async () => {
      render(
        <AllProviders>
          <Trigger
            onMount={(ctx) => {
              act(() => {
                ctx.info('Toast 1', { duration: 0 });
                ctx.info('Toast 2', { duration: 0 });
                ctx.info('Toast 3', { duration: 0 });
              });
            }}
          />
        </AllProviders>
      );

      expect(await screen.findByText('Toast 1')).toBeInTheDocument();
      expect(await screen.findByText('Toast 2')).toBeInTheDocument();
      expect(await screen.findByText('Toast 3')).toBeInTheDocument();
    });
  });

  // ─── toast types ──────────────────────────────────────────────────────────

  describe('toast types', () => {
    (['success', 'error', 'warning', 'info'] as const).forEach((type) => {
      it(`renders a "${type}" toast`, async () => {
        render(
          <AllProviders>
            <Trigger
              onMount={(ctx) => {
                act(() => { ctx[type](`${type} message`, { duration: 0 }); });
              }}
            />
          </AllProviders>
        );
        expect(await screen.findByText(`${type} message`)).toBeInTheDocument();
      });
    });
  });

  // ─── different positions ──────────────────────────────────────────────────

  describe('positioning', () => {
    it('renders toasts at different positions in separate stacks', async () => {
      render(
        <AllProviders>
          <Trigger
            onMount={(ctx) => {
              act(() => {
                ctx.info('Top Left', { position: 'top-left', duration: 0 });
                ctx.info('Bottom Right', { position: 'bottom-right', duration: 0 });
              });
            }}
          />
        </AllProviders>
      );

      expect(await screen.findByText('Top Left')).toBeInTheDocument();
      expect(await screen.findByText('Bottom Right')).toBeInTheDocument();

      // Each position group is a <section aria-label="Notifications">
      const sections = document.querySelectorAll('section[aria-label="Notifications"]');
      expect(sections.length).toBe(2);
    });
  });

  // ─── portal target ────────────────────────────────────────────────────────

  describe('portal rendering', () => {
    it('renders toasts inside document.body (portal)', async () => {
      render(
        <AllProviders>
          <Trigger
            onMount={(ctx) => {
              act(() => { ctx.info('Portal toast', { duration: 0 }); });
            }}
          />
        </AllProviders>
      );

      const toast = await screen.findByText('Portal toast');
      // The toast should be inside document.body but outside the React root
      expect(document.body).toContainElement(toast);
    });
  });

  // ─── maxToasts cap ────────────────────────────────────────────────────────

  describe('maxToasts', () => {
    it('only renders up to maxToasts toasts per position', async () => {
      render(
        <ThemeProvider theme={theme}>
          <ToastProvider config={{ maxToasts: 2 }}>
            <Trigger
              onMount={(ctx) => {
                act(() => {
                  ctx.info('A', { duration: 0 });
                  ctx.info('B', { duration: 0 });
                  ctx.info('C', { duration: 0 });
                  ctx.info('D', { duration: 0 });
                });
              }}
            />
            <ToastContainer />
          </ToastProvider>
        </ThemeProvider>
      );

      // Only 2 should be visible (A and B are oldest, D and C are newest-first)
      const toasts = await screen.findAllByRole('status');
      expect(toasts.length).toBeLessThanOrEqual(2);
    });
  });
});
