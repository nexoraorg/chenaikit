import { FeatureExtractor } from './fraud/featureExtractor';
import { AnomalyDetector } from './fraud/anomalyDetector';
import { PatternRecognizer } from './fraud/patternRecognizer';
import { RiskScorer } from './fraud/riskScorer';
import { FeedbackEvent, FraudDetectionResult, RawTransaction, RealTimeScoringOptions } from './fraud/types';

export class FraudDetector {
  private featureExtractor = new FeatureExtractor({ unusualHourRange: [{ start: 0, end: 5 }] });
  private anomalyDetector = new AnomalyDetector({ calibration: 'balanced' });
  private patternRecognizer = new PatternRecognizer();
  private riskScorer = new RiskScorer();
  private feedback: FeedbackEvent[] = [];
  private metrics = {
    total: 0,
    frauds: 0,
    falsePositives: 0,
    avgLatencyMs: 0,
  };

  async detect(tx: RawTransaction, opts: RealTimeScoringOptions = {}): Promise<FraudDetectionResult> {
    const start = Date.now();
    const timeoutMs = opts.timeoutMs ?? 100;

    // Feature extraction
    const features = this.featureExtractor.extract(tx);

    // Anomaly detection
    const anomaly = this.anomalyDetector.score(features);

    // Pattern recognition
    const patterns = this.patternRecognizer.recognize(features);

    // Risk scoring
    const risk = this.riskScorer.score(anomaly, patterns);

    const end = Date.now();
    const latencyMs = Math.max(0, end - start);

    const result: FraudDetectionResult = {
      isFraud: risk.category === 'high' || risk.category === 'critical',
      risk,
      anomaly,
      patterns,
      features,
      latencyMs,
      timestamp: new Date(),
    };

    // Basic timeout guard for real-time SLA
    if (latencyMs > timeoutMs) {
      // reduce sensitivity when timing out
      result.risk.score = Math.max(0, result.risk.score - 5);
      result.risk.reasons.push(`Adjusted due to latency ${Math.round(latencyMs)}ms > ${timeoutMs}ms`);
    }

    // Update monitoring metrics
    this.metrics.total += 1;
    this.metrics.avgLatencyMs =
      ((this.metrics.avgLatencyMs * (this.metrics.total - 1)) + latencyMs) / this.metrics.total;
    if (result.isFraud) this.metrics.frauds += 1;

    return result;
  }

  // Feedback loop to improve calibration over time
  submitFeedback(event: FeedbackEvent) {
    this.feedback.push(event);
    // Simple calibration: if false positives accumulate, shift calibration to strict
    const recent = this.feedback.slice(-100);
    const falsePositives = recent.filter((f) => !f.isFraudConfirmed).length;
    const trueFrauds = recent.filter((f) => f.isFraudConfirmed).length;
    if (falsePositives > trueFrauds * 1.5) {
      this.anomalyDetector = new AnomalyDetector({ calibration: 'strict' });
      this.metrics.falsePositives += 1;
    } else if (trueFrauds > falsePositives * 2) {
      this.anomalyDetector = new AnomalyDetector({ calibration: 'lenient' });
    } else {
      this.anomalyDetector = new AnomalyDetector({ calibration: 'balanced' });
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
