import { TrendAnalysisResult, TrendComponents, ForecasterOptions, FinancialHealth } from './types';

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(values.length, start + window);
    const m = mean(values.slice(start, end));
    out.push(m);
  }
  return out;
}

function std(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const v = mean(values.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

export class TrendAnalyzer {
  analyze(values: number[], options: ForecasterOptions = {}): TrendAnalysisResult {
    const period = options.seasonalityPeriod ?? 0;
    const window = options.windowSize ?? Math.max(3, Math.floor(values.length / 10));

    const trend = movingAverage(values, window);
    const seasonal: number[] = new Array(values.length).fill(0);
    if (period > 1) {
      const seasonalMeans = new Array(period).fill(0);
      const counts = new Array(period).fill(0);
      for (let i = 0; i < values.length; i++) {
        const idx = i % period;
        seasonalMeans[idx] += values[i] - trend[i];
        counts[idx] += 1;
      }
      for (let i = 0; i < period; i++) {
        seasonalMeans[i] = counts[i] ? seasonalMeans[i] / counts[i] : 0;
      }
      for (let i = 0; i < values.length; i++) {
        seasonal[i] = seasonalMeans[i % period];
      }
    }

    const residual = values.map((v, i) => v - trend[i] - seasonal[i]);
    const seasonalityStrength = period > 1 ? Math.min(1, std(seasonal) / (std(values) || 1)) : 0;
    const slope = trend[trend.length - 1] - trend[Math.max(0, trend.length - 2)];
    const trendDirection = slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'flat';

    const components: TrendComponents = {
      trend,
      seasonal,
      residual,
      seasonalityStrength,
      trendDirection,
      seasonalPeriod: period || undefined,
    };

    const insights: string[] = [];
    if (seasonalityStrength > 0.3) insights.push('Strong seasonality detected; consider budget adjustments around cycles.');
    if (trendDirection === 'up') insights.push('Upward trend; monitor increasing spend or leverage growth opportunities.');
    if (trendDirection === 'down') insights.push('Downward trend; potential savings or reduced activity.');
    if (std(residual) > std(values) * 0.5) insights.push('High volatility; diversify or add buffers to handle fluctuations.');

    return { components, insights };
  }

  assessFinancialHealth(spendDaily: number[], balanceDaily: number[], incomeDaily?: number[]): FinancialHealth {
    const avgSpend = mean(spendDaily);
    const avgIncome = incomeDaily && incomeDaily.length ? mean(incomeDaily) : undefined;
    const lastBalance = balanceDaily.length ? balanceDaily[balanceDaily.length - 1] : 0;
    const savingsRate = avgIncome ? Math.max(0, (avgIncome - avgSpend) / (avgIncome || 1)) : Math.max(0, (lastBalance - (balanceDaily[0] ?? lastBalance)) / ((avgSpend || 1) * spendDaily.length));
    const expenseVolatility = std(spendDaily);
    const liquidityDays = avgSpend > 0 ? Math.round(lastBalance / avgSpend) : Infinity;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (liquidityDays < 15 || expenseVolatility > avgSpend * 0.5) riskLevel = 'high';
    else if (liquidityDays < 30 || expenseVolatility > avgSpend * 0.3) riskLevel = 'medium';

    const suggestions: string[] = [];
    if (riskLevel !== 'low') suggestions.push('Increase cash buffer to cover 1–2 months of expenses.');
    if (savingsRate < 0.2) suggestions.push('Aim for 20% savings rate by reducing discretionary spend.');
    if (expenseVolatility > avgSpend * 0.3) suggestions.push('Smooth expenses by negotiating bills or batching purchases.');
    if (avgIncome && avgIncome < avgSpend) suggestions.push('Spending exceeds income; review subscriptions and variable expenses.');

    return {
      savingsRate,
      expenseVolatility,
      liquidityDays,
      debtToIncome: undefined,
      riskLevel,
      suggestions,
    };
  }
}