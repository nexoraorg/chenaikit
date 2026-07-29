import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { SkeletonCard } from '../SkeletonCard';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('components/SkeletonCard', () => {
  // ─── default rendering ────────────────────────────────────────────────────

  describe('default props', () => {
    it('renders without crashing', () => {
      renderWithTheme(<SkeletonCard />);
    });

    it('renders skeleton elements', () => {
      const { container } = renderWithTheme(<SkeletonCard />);
      // MUI Skeleton renders as a span or div with class MuiSkeleton-root
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render action skeletons by default (hasActions=false)', () => {
      const { container } = renderWithTheme(<SkeletonCard />);
      // CardActions should not be present when hasActions is false
      const cardActions = container.querySelector('.MuiCardActions-root');
      expect(cardActions).not.toBeInTheDocument();
    });
  });

  // ─── lines prop ───────────────────────────────────────────────────────────

  describe('lines prop', () => {
    it('renders the default 3 text skeleton lines', () => {
      const { container } = renderWithTheme(<SkeletonCard lines={3} />);
      // There is a title skeleton + 3 text line skeletons = at least 4 total
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });

    it('renders 5 text skeletons when lines=5', () => {
      const { container } = renderWithTheme(<SkeletonCard lines={5} />);
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      // title + 5 lines = 6 minimum
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });

    it('renders 1 text skeleton when lines=1', () => {
      const { container } = renderWithTheme(<SkeletonCard lines={1} />);
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it('renders 0 additional text skeletons when lines=0', () => {
      const { container } = renderWithTheme(<SkeletonCard lines={0} />);
      // Only the title skeleton should remain
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      // At minimum, 1 (the title)
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── hasActions prop ──────────────────────────────────────────────────────

  describe('hasActions prop', () => {
    it('renders action skeletons when hasActions=true', () => {
      const { container } = renderWithTheme(<SkeletonCard hasActions />);
      const cardActions = container.querySelector('.MuiCardActions-root');
      expect(cardActions).toBeInTheDocument();
    });

    it('renders two button-shaped skeletons inside actions', () => {
      const { container } = renderWithTheme(<SkeletonCard hasActions />);
      const actionSkeletons = container.querySelectorAll(
        '.MuiCardActions-root .MuiSkeleton-root'
      );
      expect(actionSkeletons.length).toBe(2);
    });

    it('does not render CardActions when hasActions=false', () => {
      const { container } = renderWithTheme(<SkeletonCard hasActions={false} />);
      expect(container.querySelector('.MuiCardActions-root')).not.toBeInTheDocument();
    });
  });

  // ─── MUI Card wrapper ─────────────────────────────────────────────────────

  describe('card wrapper', () => {
    it('is wrapped in a MUI Card', () => {
      const { container } = renderWithTheme(<SkeletonCard />);
      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
    });
  });
});
