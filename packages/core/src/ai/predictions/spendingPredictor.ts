import { ConfidenceInterval, ForecastMetrics, ForecasterOptions, SpendingPrediction, SpendingPredictionResult, SpendingTransaction } from './types';
import { TimeSeriesForecaster } from './timeSeriesForecaster';

function groupBy<T, K extends string | number>(items: T[], getKey: (i: T) => K): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

function toDailySeries(transactions: SpendingTransaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const day = new Date(t.date);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString();
    map.set(key, (map.get(key) || 0) + Math.abs(t.amount));
  }
  return map;
}

export class SpendingPredictor {
  private forecaster = new TimeSeriesForecaster();

  predict(transactions: SpendingTransaction[], horizonDays: number, options: ForecasterOptions = {}): SpendingPredictionResult {
    const byCategory = groupBy(transactions, (t) => t.category || 'uncategorized');
    const predictions: SpendingPrediction[] = [];
    const metricsCollect: ForecastMetrics[] = [];

    for (const [category, txs] of Object.entries(byCategory)) {
      const daily = toDailySeries(txs);
      const series = Array.from(daily.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, value]) => ({ date: new Date(iso), value }));
      if (series.length === 0) continue;
      const result = this.forecaster.forecast(series, horizonDays, options);
      metricsCollect.push(result.metrics!);

      const start = new Date(series[series.length - 1].date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + horizonDays);

      const total = result.points.reduce((sum, p) => sum + p.value, 0);
      const combinedCI: ConfidenceInterval | undefined = result.points[0]?.ci
        ? {
            level: result.points[0].ci.level,
            lower: result.points.reduce((sum, p) => sum + (p.ci?.lower ?? p.value), 0),
            upper: result.points.reduce((sum, p) => sum + (p.ci?.upper ?? p.value), 0),
          }
        : undefined;

      predictions.push({ category, amount: total, periodStart: start, periodEnd: end, ci: combinedCI });
    }

    const avgMetrics: ForecastMetrics = {
      rmse: metricsCollect.length ? metricsCollect.reduce((a, m) => a + m.rmse, 0) / metricsCollect.length : 0,
      mae: metricsCollect.length ? metricsCollect.reduce((a, m) => a + m.mae, 0) / metricsCollect.length : 0,
      mape: metricsCollect.length ? metricsCollect.reduce((a, m) => a + m.mape, 0) / metricsCollect.length : 0,
      coverage: metricsCollect.length ? metricsCollect.reduce((a, m) => a + (m.coverage || 0), 0) / metricsCollect.length : undefined,
    };

    return { predictions, metrics: avgMetrics };
  }
}