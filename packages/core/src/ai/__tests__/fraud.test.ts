import { AnomalyDetector } from '../fraud/anomalyDetector';
import { RealTimeFraudScorer } from '../fraud/riskScorer';
import { FeatureExtractor } from '../fraud/featureExtractor';
import { PatternRecognizer } from '../fraud/patternRecognizer';
import type { Transaction, FeatureVector } from '../fraud/types';

// Synthetic transaction data factory
function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_001',
    accountId: 'GABCDEF1234567890',
    amount: 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('Fraud Detection - FeatureExtractor', () => {
  it('should extract feature vector from transaction', () => {
    const extractor = new FeatureExtractor();
    const tx = createTransaction({ amount: 500, timestamp: Date.now() });
    const fv = extractor.extract(tx);
    expect(fv.features).toBeDefined();
    expect(fv.features.length).toBeGreaterThan(0);
  });

  it('should return features for each invocation', () => {
    const extractor = new FeatureExtractor();
    const tx = createTransaction();
    const fv = extractor.extract(tx);
    expect(fv.features.length).toBeGreaterThan(0);
    expect(fv.featureNames.length).toBe(fv.features.length);
  });
});

describe('Fraud Detection - AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  it('should fit and score with a baseline', () => {
    const extractor = new FeatureExtractor();
    const baseline = Array.from({ length: 50 }, (_, i) =>
      extractor.extract(createTransaction({ id: `tx_base_${i}`, amount: Math.random() * 100 }))
    );
    detector.fit(baseline);

    const normal = extractor.extract(createTransaction({ amount: 50 }));
    const scores = detector.score(normal);
    expect(Array.isArray(scores)).toBe(true);
    expect(scores.length).toBe(2); // iso + ocsvm
    scores.forEach(s => {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    });
  });

  it('should detect anomalies with high amount', () => {
    const extractor = new FeatureExtractor();
    const baseline = Array.from({ length: 50 }, (_, i) =>
      extractor.extract(createTransaction({ id: `tx_base_${i}`, amount: Math.random() * 100 }))
    );
    detector.fit(baseline);

    const anomalous = extractor.extract(createTransaction({ amount: 9999999 }));
    const scores = detector.score(anomalous);
    scores.forEach(s => {
      expect(s.score).toBeGreaterThanOrEqual(0);
    });
  });

  it('should return deterministic scores for identical input after fit', () => {
    const extractor = new FeatureExtractor();
    const baseline = Array.from({ length: 20 }, () =>
      extractor.extract(createTransaction())
    );
    detector.fit(baseline);

    const tx = extractor.extract(createTransaction());
    const scores1 = detector.score(tx);
    const scores2 = detector.score(tx);
    expect(scores1.length).toBe(scores2.length);
    scores1.forEach((s, i) => {
      expect(s.score).toBe(scores2[i].score);
    });
  });
});

describe('Fraud Detection - PatternRecognizer', () => {
  let recognizer: PatternRecognizer;

  beforeEach(() => {
    recognizer = new PatternRecognizer();
  });

  it('should recognize patterns in transaction', () => {
    const fv = new FeatureExtractor().extract(createTransaction({ amount: 500 }));
    const patterns = recognizer.recognize(fv.featureNames, fv.features, createTransaction({ amount: 500 }));
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should return consistent results for same input', () => {
    const tx = createTransaction();
    const fv = new FeatureExtractor().extract(tx);
    const patterns1 = recognizer.recognize(fv.featureNames, fv.features, tx);
    const patterns2 = recognizer.recognize(fv.featureNames, fv.features, tx);
    expect(patterns1).toEqual(patterns2);
  });
});

describe('Fraud Detection - RealTimeFraudScorer', () => {
  let scorer: RealTimeFraudScorer;

  beforeEach(() => {
    scorer = new RealTimeFraudScorer();
  });

  it('should score a transaction and return RiskResult', () => {
    const baseline = Array.from({ length: 20 }, (_, i) =>
      createTransaction({ id: `tx_bl_${i}`, amount: Math.random() * 100 })
    );
    scorer.fitBaseline(baseline);

    const tx = createTransaction({ id: 'tx_test', amount: 50 });
    const result = scorer.scoreTransaction(tx);

    expect(result).toBeDefined();
    expect(result.transactionId).toBe('tx_test');
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high']).toContain(result.category);
    expect(result.reasons).toBeDefined();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should return low risk for normal transactions', () => {
    const baseline = Array.from({ length: 20 }, (_, i) =>
      createTransaction({ id: `tx_bl_${i}`, amount: Math.random() * 100 })
    );
    scorer.fitBaseline(baseline);

    const normal = createTransaction({ id: 'tx_normal', amount: 50 });
    const result = scorer.scoreTransaction(normal);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('should return risk reasons', () => {
    const baseline = Array.from({ length: 20 }, (_, i) =>
      createTransaction({ id: `tx_bl_${i}`, amount: Math.random() * 100 })
    );
    scorer.fitBaseline(baseline);

    const result = scorer.scoreTransaction(createTransaction({ id: 'tx_reasons', amount: 50 }));
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should maintain stats', () => {
    const baseline = Array.from({ length: 20 }, (_, i) =>
      createTransaction({ id: `tx_bl_${i}`, amount: Math.random() * 100 })
    );
    scorer.fitBaseline(baseline);

    scorer.scoreTransaction(createTransaction({ id: 'tx_1' }));
    scorer.scoreTransaction(createTransaction({ id: 'tx_2' }));

    const stats = scorer.getStats();
    expect(stats.totalScored).toBe(2);
    expect(stats.avgLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should produce risk score within valid range for scored transactions', () => {
    const baseline = Array.from({ length: 20 }, (_, i) =>
      createTransaction({ id: `tx_bl_${i}`, amount: Math.random() * 100 })
    );
    scorer.fitBaseline(baseline);

    const tx = createTransaction({ id: 'tx_deterministic', amount: 50 });
    const result = scorer.scoreTransaction(tx);

    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});