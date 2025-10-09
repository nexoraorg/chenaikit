import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CreditScoreCard from '../components/CreditScoreCard';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('CreditScoreCard', () => {
  const mockDate = new Date('2025-10-05T10:00:00Z');

  describe('Loading State', () => {
    it('renders loading spinner when loading is true', () => {
      renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
          loading={true}
        />
      );

      expect(screen.getByText(/loading credit score/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('renders error message when error prop is provided', () => {
      const errorMessage = 'Failed to fetch credit score';
      renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Score Display', () => {
    it('renders credit score correctly', () => {
      renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.getByText(/out of 100/i)).toBeInTheDocument();
    });

    it('displays "Poor" rating for score 0-39', () => {
      renderWithTheme(
        <CreditScoreCard
          score={35}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('displays "Fair" rating for score 40-69', () => {
      renderWithTheme(
        <CreditScoreCard
          score={55}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText('Fair')).toBeInTheDocument();
    });

    it('displays "Good" rating for score 70-84', () => {
      renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('displays "Excellent" rating for score 85-100', () => {
      renderWithTheme(
        <CreditScoreCard
          score={90}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });
  });

  describe('Score Trend', () => {
    it('displays positive trend when score increased', () => {
      renderWithTheme(
        <CreditScoreCard
          score={80}
          previousScore={70}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText(/10 points/i)).toBeInTheDocument();
    });

    it('displays negative trend when score decreased', () => {
      renderWithTheme(
        <CreditScoreCard
          score={70}
          previousScore={80}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText(/10 points/i)).toBeInTheDocument();
    });

    it('displays singular "point" for 1 point difference', () => {
      renderWithTheme(
        <CreditScoreCard
          score={71}
          previousScore={70}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText(/1 point$/i)).toBeInTheDocument();
    });

    it('does not display trend when previousScore is not provided', () => {
      renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
        />
      );

      expect(screen.queryByText(/point/i)).not.toBeInTheDocument();
    });
  });

  describe('Last Updated', () => {
    it('displays last updated time', () => {
      renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      const { container } = renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
        />
      );

      const region = container.querySelector('[role="region"]');
      expect(region).toHaveAttribute('aria-label', 'Credit Score Card');
    });

    it('has score indicator with aria-label', () => {
      const { container } = renderWithTheme(
        <CreditScoreCard
          score={75}
          lastUpdated={mockDate}
        />
      );

      const scoreIndicator = container.querySelector('[aria-label*="Score indicator"]');
      expect(scoreIndicator).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles score of 0 correctly', () => {
      renderWithTheme(
        <CreditScoreCard
          score={0}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('handles score of 100 correctly', () => {
      renderWithTheme(
        <CreditScoreCard
          score={100}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('handles no score change (previousScore equals current score)', () => {
      renderWithTheme(
        <CreditScoreCard
          score={75}
          previousScore={75}
          lastUpdated={mockDate}
        />
      );

      expect(screen.getByText(/0 points/i)).toBeInTheDocument();
    });
  });
});
