import { AnomalyDetector } from './anomalyDetector';
import { FeatureExtractor } from './featureExtractor';
import { PatternRecognizer } from './patternRecognizer';
import { AnomalyScore, FeedbackEvent, FeatureVector, MonitorStats, RiskCategory, RiskResult, Transaction } from './types';

function categorize(score: number): RiskCategory {
  if (score < 30) return 'low';
  if (score < 70) return 'medium';
  return 'high';
}

export class RealTimeFraudScorer {
  private extractor = new FeatureExtractor();
  private detector = new AnomalyDetector();
  private patterns = new PatternRecognizer();
  private baselineSamples: FeatureVector[] = [];
  private latencies: number[] = [];
  private feedback: FeedbackEvent[] = [];
  private stats: MonitorStats = {
    totalScored: 0,
    avgLatencyMs: 0,
    p99LatencyMs: 0,
    lastUpdated: Date.now(),
  };

  fitBaseline(transactions: Transaction[]) {
    const samples = transactions.map((t) => this.extractor.extract(t));
    this.baselineSamples = samples.slice(-2000); // cap baseline for performance
    this.detector.fit(this.baselineSamples);
  }

  scoreTransaction(tx: Transaction): RiskResult {
    const t0 = Date.now();
    const fv = this.extractor.extract(tx);
    const anomalyScores = this.detector.score(fv);
    const patternFindings = this.patterns.recognize(fv.featureNames, fv.features, tx);

    const riskScore = this.aggregate(anomalyScores, patternFindings);
    const category = categorize(riskScore);
    const reasons = this.reasons(anomalyScores, patternFindings);
    const latencyMs = Date.now() - t0;
    this.updateStats(latencyMs);

    return {
      transactionId: tx.id,
      riskScore,
      category,
      reasons,
      components: { anomalyScores, patternFindings },
      latencyMs,
      timestamp: Date.now(),
    };
  }

  recordFeedback(event: FeedbackEvent) {
    this.feedback.push(event);
    if (this.feedback.length > 10000) this.feedback.shift();
    // Simple online adjustment: if many false positives recently, reduce anomaly weight
    const window = this.feedback.slice(-1000);
    const positives = window.filter((f) => f.isFraud).length;
    const negatives = window.length - positives;
    const fpr = negatives / Math.max(1, window.length);
    // Adjust detector nu in OneClass approx
    // Higher false positives -> lower nu (more lenient)
    // Note: rebuilding detector would require refit; keep track by refitting periodically
    if (fpr > 0.2 && this.baselineSamples.length) {
      this.detector.fit(this.baselineSamples.slice(-1000));
    }
  }

  getStats(): MonitorStats {
    return { ...this.stats };
  }

  private aggregate(anoms: AnomalyScore[], patterns: ReturnType<PatternRecognizer['recognize']>): number {
    // Weighted aggregation prioritizing precision
    const anomalyWeight = 0.6;
    const patternWeight = 0.4;
    const anomalyAvg = anoms.reduce((a, s) => a + s.score, 0) / Math.max(1, anoms.length);
    const patternAvg = patterns.reduce((a, p) => a + p.score, 0) / Math.max(1, patterns.length);
    const score01 = anomalyWeight * anomalyAvg + patternWeight * patternAvg;
    return Math.round(score01 * 100);
  }

  private reasons(anoms: AnomalyScore[], patterns: ReturnType<PatternRecognizer['recognize']>): string[] {
    const reasons: string[] = [];
    for (const a of anoms) {
      if (a.score > 0.6) reasons.push(`Anomaly (${a.model}) score=${a.score.toFixed(2)}`);
    }
    for (const p of patterns) {
      if (p.score > 0.5) reasons.push(`${p.name}: ${p.reason}`);
    }
    if (reasons.length === 0) reasons.push('Normal pattern within expected ranges');
    return reasons;
  }

  private updateStats(latency: number) {
    this.latencies.push(latency);
    if (this.latencies.length > 5000) this.latencies.shift();
    const total = this.stats.totalScored + 1;
    const avg = ((this.stats.avgLatencyMs * this.stats.totalScored) + latency) / total;
    const p99 = percentile(this.latencies, 0.99);
    this.stats = {
      ...this.stats,
      totalScored: total,
      avgLatencyMs: avg,
      p99LatencyMs: p99,
      lastUpdated: Date.now(),
    };
  }
}

function percentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.floor(p * (a.length - 1));
  return a[idx];
}