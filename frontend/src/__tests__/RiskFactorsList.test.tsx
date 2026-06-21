import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import RiskFactorsList from '../components/RiskFactorsList';
import { RiskFactor } from '../types/credit-score';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('RiskFactorsList', () => {
  const mockFactors: RiskFactor[] = [
    {
      id: '1',
      description: 'Excellent payment history with no missed payments',
      impact: 'positive',
      severity: 'high'
    },
    {
      id: '2',
      description: 'High transaction volume demonstrates active usage',
      impact: 'positive',
      severity: 'medium'
    },
    {
      id: '3',
      description: 'Recent spike in transaction volume may indicate risk',
      impact: 'negative',
      severity: 'low'
    },
    {
      id: '4',
      description: 'Multiple missed or late payments',
      impact: 'negative',
      severity: 'high'
    }
  ];

  describe('Loading State', () => {
    it('renders loading spinner when loading is true', () => {
      renderWithTheme(
        <RiskFactorsList
          factors={[]}
          loading={true}
        />
      );

      expect(screen.getByText(/loading risk factors/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('renders error message when error prop is provided', () => {
      const errorMessage = 'Failed to fetch risk factors';
      renderWithTheme(
        <RiskFactorsList
          factors={[]}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders success message when no factors are present', () => {
      renderWithTheme(
        <RiskFactorsList factors={[]} />
      );

      expect(screen.getByText(/no risk factors identified/i)).toBeInTheDocument();
      expect(screen.getByText(/your credit profile looks great/i)).toBeInTheDocument();
    });
  });

  describe('Factors Display', () => {
    it('renders list title', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      expect(screen.getByText('Risk Factors Analysis')).toBeInTheDocument();
    });

    it('displays all risk factors', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      mockFactors.forEach(factor => {
        expect(screen.getByText(factor.description)).toBeInTheDocument();
      });
    });

    it('shows correct count of positive factors', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      const positiveCount = mockFactors.filter(f => f.impact === 'positive').length;
      expect(screen.getByText(`${positiveCount} Positive`)).toBeInTheDocument();
    });

    it('shows correct count of negative factors', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      const negativeCount = mockFactors.filter(f => f.impact === 'negative').length;
      expect(screen.getByText(`${negativeCount} Negative`)).toBeInTheDocument();
    });

    it('displays impact labels correctly', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      const positiveLabels = screen.getAllByText('Positive');
      const negativeLabels = screen.getAllByText('Negative');

      const positiveFactorsCount = mockFactors.filter(f => f.impact === 'positive').length;
      const negativeFactorsCount = mockFactors.filter(f => f.impact === 'negative').length;

      expect(positiveLabels.length).toBeGreaterThanOrEqual(positiveFactorsCount);
      expect(negativeLabels.length).toBeGreaterThanOrEqual(negativeFactorsCount);
    });

    it('displays severity labels correctly', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Low').length).toBeGreaterThan(0);
    });
  });

  describe('Max Items Feature', () => {
    it('limits displayed items when maxItems is set', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} maxItems={2} />
      );

      const firstFactor = screen.getByText(mockFactors[0].description);
      const secondFactor = screen.getByText(mockFactors[1].description);

      expect(firstFactor).toBeInTheDocument();
      expect(secondFactor).toBeInTheDocument();

      const showMoreButton = screen.getByRole('button', { name: /show.*more/i });
      expect(showMoreButton).toBeInTheDocument();
    });

    it('expands to show all items when "Show More" is clicked', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} maxItems={2} />
      );

      const showMoreButton = screen.getByRole('button', { name: /show.*more/i });
      fireEvent.click(showMoreButton);

      mockFactors.forEach(factor => {
        expect(screen.getByText(factor.description)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    });

    it('collapses items when "Show Less" is clicked after expansion', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} maxItems={2} />
      );

      const showMoreButton = screen.getByRole('button', { name: /show.*more/i });
      fireEvent.click(showMoreButton);

      const showLessButton = screen.getByRole('button', { name: /show less/i });
      fireEvent.click(showLessButton);

      expect(screen.getByRole('button', { name: /show.*more/i })).toBeInTheDocument();
    });

    it('does not show expand/collapse button when all items fit', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} maxItems={10} />
      );

      expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      const { container } = renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      const region = container.querySelector('[role="region"]');
      expect(region).toHaveAttribute('aria-label', 'Risk Factors List');
    });
  });

  describe('Footer Info', () => {
    it('displays informational footer text', () => {
      renderWithTheme(
        <RiskFactorsList factors={mockFactors} />
      );

      expect(screen.getByText(/ai-powered analysis/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles only positive factors', () => {
      const positiveFactors: RiskFactor[] = [
        {
          id: '1',
          description: 'Good payment history',
          impact: 'positive',
          severity: 'high'
        }
      ];

      renderWithTheme(
        <RiskFactorsList factors={positiveFactors} />
      );

      expect(screen.getByText('1 Positive')).toBeInTheDocument();
      expect(screen.getByText('0 Negative')).toBeInTheDocument();
    });

    it('handles only negative factors', () => {
      const negativeFactors: RiskFactor[] = [
        {
          id: '1',
          description: 'Late payments detected',
          impact: 'negative',
          severity: 'high'
        }
      ];

      renderWithTheme(
        <RiskFactorsList factors={negativeFactors} />
      );

      expect(screen.getByText('0 Positive')).toBeInTheDocument();
      expect(screen.getByText('1 Negative')).toBeInTheDocument();
    });

    it('handles single factor', () => {
      const singleFactor: RiskFactor[] = [mockFactors[0]];

      renderWithTheme(
        <RiskFactorsList factors={singleFactor} />
      );

      expect(screen.getByText(singleFactor[0].description)).toBeInTheDocument();
    });

    it('handles large number of factors', () => {
      const manyFactors: RiskFactor[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        description: `Risk factor ${i + 1}`,
        impact: i % 2 === 0 ? 'positive' : 'negative',
        severity: ['low', 'medium', 'high'][i % 3] as 'low' | 'medium' | 'high'
      }));

      renderWithTheme(
        <RiskFactorsList factors={manyFactors} maxItems={5} />
      );

      expect(screen.getByRole('button', { name: /show 15 more factors/i })).toBeInTheDocument();
    });
  });
});
