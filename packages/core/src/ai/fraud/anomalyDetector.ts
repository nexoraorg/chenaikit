import { AnomalyModel, AnomalyScore, FeatureVector } from './types';

// Lightweight, real-time friendly anomaly detectors

class IsolationForestApprox implements AnomalyModel {
  private featureMins: number[] = [];
  private featureMaxs: number[] = [];
  private iqrLow: number[] = [];
  private iqrHigh: number[] = [];
  private featureCount = 0;

  fit(samples: FeatureVector[]): void {
    if (samples.length === 0) return;
    const F = samples[0].features.length;
    this.featureCount = F;
    const cols: number[][] = Array.from({ length: F }, () => []);
    for (const s of samples) {
      for (let i = 0; i < F; i++) cols[i].push(s.features[i]);
    }
    this.featureMins = cols.map((c) => Math.min(...c));
    this.featureMaxs = cols.map((c) => Math.max(...c));
    // Compute approximate IQR bounds
    this.iqrLow = cols.map((c) => quantile(c, 0.25));
    this.iqrHigh = cols.map((c) => quantile(c, 0.75));
  }

  score(sample: FeatureVector): AnomalyScore {
    const outliers: number[] = [];
    for (let i = 0; i < this.featureCount; i++) {
      const v = sample.features[i];
      const low = this.iqrLow[i];
      const high = this.iqrHigh[i];
      const min = this.featureMins[i];
      const max = this.featureMaxs[i];
      // outside IQR scaled by range
      let deviation = 0;
      if (v < low) deviation = (low - v) / Math.max(1e-6, low - min);
      else if (v > high) deviation = (v - high) / Math.max(1e-6, max - high);
      outliers.push(Math.min(1, Math.max(0, deviation)));
    }
    const score = clamp(0, 1, outliers.reduce((a, b) => a + b, 0) / Math.max(1, outliers.length));
    return {
      score,
      model: 'isolation_forest',
      details: { outlierByFeature: outliers },
    };
  }
}

class OneClassSVMApprox implements AnomalyModel {
  private means: number[] = [];
  private stds: number[] = [];
  private featureCount = 0;
  private nu = 0.1; // approximate fraction of outliers

  constructor(nu?: number) {
    if (nu !== undefined) this.nu = nu;
  }

  fit(samples: FeatureVector[]): void {
    if (samples.length === 0) return;
    const F = samples[0].features.length;
    this.featureCount = F;
    const cols: number[][] = Array.from({ length: F }, () => []);
    for (const s of samples) {
      for (let i = 0; i < F; i++) cols[i].push(s.features[i]);
    }
    this.means = cols.map((c) => mean(c));
    this.stds = cols.map((c) => std(c) || 1e-6);
  }

  score(sample: FeatureVector): AnomalyScore {
    const z: number[] = [];
    for (let i = 0; i < this.featureCount; i++) {
      const v = sample.features[i];
      z.push(Math.abs((v - this.means[i]) / this.stds[i]));
    }
    const distance = z.reduce((a, b) => a + b * b, 0); // squared z-distance
    // Map distance to [0,1] via logistic based on nu
    const threshold = Math.max(1e-3, invLogitTarget(this.nu));
    const raw = 1 / (1 + Math.exp(-(distance - threshold)));
    const score = clamp(0, 1, raw);
    return {
      score,
      model: 'one_class_svm',
      details: { zScores: z, distance },
    };
  }
}

function mean(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function std(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
  return Math.sqrt(v);
}
function clamp(min: number, max: number, v: number) {
  return Math.min(max, Math.max(min, v));
}
function quantile(arr: number[], q: number) {
  if (arr.length === 0) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.floor(q * (a.length - 1));
  return a[idx];
}
function invLogitTarget(nu: number) {
  // rough mapping: smaller nu -> lower threshold
  return Math.log(1 / nu - 1);
}

export class AnomalyDetector {
  private iso = new IsolationForestApprox();
  private ocsvm = new OneClassSVMApprox(0.1);

  fit(samples: FeatureVector[]) {
    // Keep fitting lightweight to meet real-time constraints
    this.iso.fit(samples);
    this.ocsvm.fit(samples);
  }

  score(sample: FeatureVector): AnomalyScore[] {
    return [this.iso.score(sample), this.ocsvm.score(sample)];
  }
}