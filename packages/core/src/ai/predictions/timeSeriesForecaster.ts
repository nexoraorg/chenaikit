import { ConfidenceInterval, ForecastMetrics, ForecastPoint, ForecastResult, ForecasterOptions, TimeSeriesPoint } from './types';

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const v = mean(values.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function zValueFor(level: number): number {
  // Normal approximation z-values for common confidence levels
  if (level >= 0.99) return 2.576;
  if (level >= 0.975) return 1.96; // ~95%
  if (level >= 0.90) return 1.645;
  return 1.96;
}

function detectSeasonalityPeriod(series: number[], minP = 4, maxP = 24): number | undefined {
  if (series.length < minP * 2) return undefined;
  let bestPeriod: number | undefined;
  let bestStrength = -Infinity;
  for (let p = minP; p <= Math.min(maxP, Math.floor(series.length / 2)); p++) {
    const seasonal: number[] = new Array(p).fill(0);
    const counts: number[] = new Array(p).fill(0);
    for (let i = 0; i < series.length; i++) {
      const idx = i % p;
      seasonal[idx] += series[i];
      counts[idx] += 1;
    }
    const seasonalAvg = seasonal.map((s, i) => (counts[i] ? s / counts[i] : 0));
    const seasonalMean = mean(seasonalAvg);
    const seasonalCentered = seasonalAvg.map((s) => s - seasonalMean);
    const strength = std(seasonalCentered);
    if (strength > bestStrength) {
      bestStrength = strength;
      bestPeriod = p;
    }
  }
  return bestPeriod;
}

export class TimeSeriesForecaster {
  forecast(points: TimeSeriesPoint[], horizon: number, options: ForecasterOptions = {}): ForecastResult {
    const values = points.map((p) => p.value);
    const dates = points.map((p) => p.date);
    const confidenceLevel = options.confidenceLevel ?? 0.95;
    const z = zValueFor(confidenceLevel);

    let m = options.seasonalityPeriod ?? detectSeasonalityPeriod(values) ?? 0;
    const alpha = options.adaptivity ?? 0.3;
    const beta = Math.min(0.2 + alpha / 2, 0.5);
    const gamma = Math.min(0.1 + alpha / 3, 0.5);

    let l = values[0] ?? 0; // level
    let b = (values[1] ?? values[0] ?? 0) - (values[0] ?? 0); // trend
    let s: number[] = m > 0 ? new Array(m).fill(0) : [];

    if (m > 0 && values.length >= m) {
      const seasonalSums = new Array(m).fill(0);
      const seasonalCounts = new Array(m).fill(0);
      for (let i = 0; i < values.length; i++) {
        const idx = i % m;
        seasonalSums[idx] += values[i];
        seasonalCounts[idx] += 1;
      }
      const avg = mean(values);
      s = seasonalSums.map((sum, i) => (seasonalCounts[i] ? sum / seasonalCounts[i] - avg : 0));
    }

    const fitted: number[] = [];
    const residuals: number[] = [];
    for (let t = 0; t < values.length; t++) {
      const seasonal = m > 0 ? s[t % m] : 0;
      const yhat = l + b + seasonal;
      fitted.push(yhat);
      const err = values[t] - yhat;
      residuals.push(err);
      const prevL = l;
      // Holt-Winters additive update
      l = alpha * (values[t] - seasonal) + (1 - alpha) * (l + b);
      b = beta * (l - prevL) + (1 - beta) * b;
      if (m > 0) {
        s[t % m] = gamma * (values[t] - l) + (1 - gamma) * seasonal;
      }
    }

    const resStd = std(residuals);
    const lastDate = dates[dates.length - 1] ?? new Date();
    const pointsOut: ForecastPoint[] = [];
    for (let h = 1; h <= horizon; h++) {
      const seasonal = m > 0 ? s[(values.length + h - 1) % m] : 0;
      const value = l + b * h + seasonal;
      const ci: ConfidenceInterval = {
        lower: value - z * resStd,
        upper: value + z * resStd,
        level: confidenceLevel,
      };
      const date = new Date(lastDate.getTime());
      date.setDate(date.getDate() + h); // assume daily cadence for simplicity
      pointsOut.push({ date, value, ci });
    }

    const actuals = values;
    const metrics: ForecastMetrics = {
      rmse: Math.sqrt(mean(residuals.map((e) => e * e))) || 0,
      mae: mean(residuals.map((e) => Math.abs(e))) || 0,
      mape: mean(residuals.map((e, i) => (actuals[i] ? Math.abs(e / actuals[i]) : 0))) || 0,
      coverage: confidenceLevel,
    };

    return { points: pointsOut, metrics };
  }
}