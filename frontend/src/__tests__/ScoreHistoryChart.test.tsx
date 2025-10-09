import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import ScoreHistoryChart from '../components/ScoreHistoryChart';
import { CreditScoreHistory } from '../types/credit-score';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ScoreHistoryChart', () => {
  const mockHistoryData: CreditScoreHistory[] = [
    { score: 65, timestamp: new Date('2025-09-01') },
    { score: 70, timestamp: new Date('2025-09-08') },
    { score: 68, timestamp: new Date('2025-09-15') },
    { score: 75, timestamp: new Date('2025-09-22') },
    { score: 80, timestamp: new Date('2025-09-29') }
  ];

  describe('Loading State', () => {
    it('renders loading spinner when loading is true', () => {
      renderWithTheme(
        <ScoreHistoryChart
          data={[]}
          loading={true}
        />
      );

      expect(screen.getByText(/loading score history/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('renders error message when error prop is provided', () => {
      const errorMessage = 'Failed to fetch score history';
      renderWithTheme(
        <ScoreHistoryChart
          data={[]}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders info message when data is empty', () => {
      renderWithTheme(
        <ScoreHistoryChart data={[]} />
      );

      expect(screen.getByText(/no score history available/i)).toBeInTheDocument();
    });
  });

  describe('Chart Display', () => {
    it('renders chart title', () => {
      renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      expect(screen.getByText('Score History')).toBeInTheDocument();
    });

    it('displays current score stat', () => {
      renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('displays average score stat', () => {
      renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      expect(screen.getByText('Average')).toBeInTheDocument();
      const average = Math.round((65 + 70 + 68 + 75 + 80) / 5);
      expect(screen.getByText(average.toString())).toBeInTheDocument();
    });

    it('displays high score stat', () => {
      renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('displays low score stat', () => {
      renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('renders all score rating categories in legend', () => {
      renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      expect(screen.getByText(/poor \(0-39\)/i)).toBeInTheDocument();
      expect(screen.getByText(/fair \(40-69\)/i)).toBeInTheDocument();
      expect(screen.getByText(/good \(70-84\)/i)).toBeInTheDocument();
      expect(screen.getByText(/excellent \(85-100\)/i)).toBeInTheDocument();
    });
  });

  describe('Custom Height', () => {
    it('applies custom height when provided', () => {
      const { container } = renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} height={500} />
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveStyle({ height: '500px' });
    });

    it('uses default height when not provided', () => {
      const { container } = renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveStyle({ height: '400px' });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      const { container } = renderWithTheme(
        <ScoreHistoryChart data={mockHistoryData} />
      );

      const region = container.querySelector('[role="region"]');
      expect(region).toHaveAttribute('aria-label', 'Credit Score History Chart');
    });
  });

  describe('Edge Cases', () => {
    it('handles single data point', () => {
      const singleDataPoint: CreditScoreHistory[] = [
        { score: 75, timestamp: new Date('2025-09-01') }
      ];

      renderWithTheme(
        <ScoreHistoryChart data={singleDataPoint} />
      );

      expect(screen.getByText('Score History')).toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('handles all scores at minimum (0)', () => {
      const minScores: CreditScoreHistory[] = [
        { score: 0, timestamp: new Date('2025-09-01') },
        { score: 0, timestamp: new Date('2025-09-08') }
      ];

      renderWithTheme(
        <ScoreHistoryChart data={minScores} />
      );

      expect(screen.getByText('Score History')).toBeInTheDocument();
    });

    it('handles all scores at maximum (100)', () => {
      const maxScores: CreditScoreHistory[] = [
        { score: 100, timestamp: new Date('2025-09-01') },
        { score: 100, timestamp: new Date('2025-09-08') }
      ];

      renderWithTheme(
        <ScoreHistoryChart data={maxScores} />
      );

      expect(screen.getByText('Score History')).toBeInTheDocument();
    });

    it('handles large dataset efficiently', () => {
      const largeDataset: CreditScoreHistory[] = Array.from({ length: 365 }, (_, i) => ({
        score: 50 + Math.floor(Math.random() * 50),
        timestamp: new Date(2024, 0, i + 1)
      }));

      renderWithTheme(
        <ScoreHistoryChart data={largeDataset} />
      );

      expect(screen.getByText('Score History')).toBeInTheDocument();
    });
  });
});
