import { BalanceSnapshot, CashFlow, ForecastMetrics, ForecastResult, ForecasterOptions, TimeSeriesPoint } from './types';
import { TimeSeriesForecaster } from './timeSeriesForecaster';

export class BalanceForecaster {
  private forecaster = new TimeSeriesForecaster();

  forecastFromBalance(history: BalanceSnapshot[], horizonDays: number, options: ForecasterOptions = {}): ForecastResult {
    const series: TimeSeriesPoint[] = history
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((h) => ({ date: h.date, value: h.balance }));
    return this.forecaster.forecast(series, horizonDays, options);
  }

  forecastFromCashFlow(currentBalance: number, flows: CashFlow[], horizonDays: number, options: ForecasterOptions = {}): ForecastResult {
    const sorted = flows.sort((a, b) => a.date.getTime() - b.date.getTime());
    const daily: Map<string, number> = new Map();
    for (const f of sorted) {
      const d = new Date(f.date);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString();
      const net = (daily.get(key) || 0) + (f.inflow - f.outflow);
      daily.set(key, net);
    }

    const cumulative: TimeSeriesPoint[] = [];
    let bal = currentBalance;
    const entries = Array.from(daily.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [iso, net] of entries) {
      bal += net;
      cumulative.push({ date: new Date(iso), value: bal });
    }
    if (cumulative.length === 0) {
      cumulative.push({ date: new Date(), value: currentBalance });
    }

    const result = this.forecaster.forecast(cumulative, horizonDays, options);
    return result;
  }
}