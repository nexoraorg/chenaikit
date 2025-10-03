import { AnomalyDetectorOptions, AnomalyScores, TransactionFeatures } from './types';

// Lightweight, online-friendly anomaly detector approximations.
// Isolation Forest approximation via random partition depth across selected features.
// One-Class SVM approximation via centroid distance and margin.

type IFTree = { feature: keyof TransactionFeatures; threshold: number; leftDepth: number; rightDepth: number }[];

export class AnomalyDetector {
  private opts: AnomalyDetectorOptions;
  private trees: IFTree[] = [];
  private centroid: Partial<Record<keyof TransactionFeatures, number>> = {};
  private count = 0;

  constructor(opts: AnomalyDetectorOptions = {}) {
    this.opts = { weightIF: 0.6, weightSVM: 0.4, calibration: 'balanced', ...opts };
    // Initialize a few shallow random trees with common features
    const features: (keyof TransactionFeatures)[] = [
      'absAmount',
      'amountZScore',
      'hourOfDay',
      'dayOfWeek',
      'rollingTxnCount1h',
      'rollingTxnCount24h',
      'rollingAmount24h',
      'geoDistanceKm',
    ];
    for (let i = 0; i < 7; i++) {
      const tree: IFTree = [];
      for (let d = 0; d < 3; d++) {
        const f = features[Math.floor(Math.random() * features.length)];
        const threshold = Math.random() * 1.0; // normalized later
        tree.push({ feature: f, threshold, leftDepth: d + 1, rightDepth: d + 1 });
      }
      this.trees.push(tree);
    }
  }

  private updateCentroid(features: TransactionFeatures) {
    const keys = Object.keys(features) as (keyof TransactionFeatures)[];
    this.count += 1;
    for (const k of keys) {
      const v = (features as any)[k];
      if (typeof v !== 'number' || !isFinite(v)) continue;
      const prev = this.centroid[k] || 0;
      // incremental mean
      this.centroid[k] = prev + (v - prev) / this.count;
    }
  }

  private normalize(features: TransactionFeatures): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(features)) {
      if (typeof v === 'number' && isFinite(v)) {
        // Simple normalization: log1p for large scales then min-max clamp
        const val = Math.log1p(Math.abs(v));
        out[k] = Math.min(1, val / 10);
      }
    }
    return out;
  }

  private isolationDepth(norm: Record<string, number>, tree: IFTree): number {
    let depth = 0;
    for (const node of tree) {
      const v = norm[node.feature as string] ?? 0.5;
      if (v < node.threshold) depth += node.leftDepth; else depth += node.rightDepth;
    }
    return depth;
  }

  private svmDistance(features: TransactionFeatures): number {
    // distance from centroid as proxy for one-class svm margin
    let sum = 0;
    let count = 0;
    for (const [k, v] of Object.entries(features)) {
      if (typeof v !== 'number' || !isFinite(v)) continue;
      const c = this.centroid[k as keyof TransactionFeatures] ?? 0;
      const d = v - c;
      sum += d * d;
      count += 1;
    }
    const dist = Math.sqrt(sum / Math.max(1, count));
    // normalize via log
    return Math.min(1, Math.log1p(dist) / 5);
  }

  score(features: TransactionFeatures): AnomalyScores {
    // update model state for online normalization and centroid
    this.updateCentroid(features);
    const norm = this.normalize(features);

    // Isolation Forest: shorter path length => more anomalous
    const depths = this.trees.map((t) => this.isolationDepth(norm, t));
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
    const ifScore = Math.min(1, 1 / (1 + avgDepth));

    // One-Class SVM approximation
    const svmScore = this.svmDistance(features);

    // Ensemble
    let ensemble = this.opts.weightIF! * ifScore + this.opts.weightSVM! * svmScore;
    // calibration
    if (this.opts.calibration === 'strict') ensemble = Math.max(0, ensemble - 0.1);
    if (this.opts.calibration === 'lenient') ensemble = Math.min(1, ensemble + 0.1);

    return { isolationForest: ifScore, oneClassSvm: svmScore, ensemble };
  }
}