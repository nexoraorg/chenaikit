import { AnomalyScores, RiskCategory, RiskScorerOptions, RiskScore, FraudPattern, PatternMatch } from './types';

export class RiskScorer {
  private opts: RiskScorerOptions;

  constructor(opts: RiskScorerOptions = {}) {
    this.opts = {
      thresholds: { low: 20, medium: 40, high: 65, critical: 85 },
      patternBoosts: {
        rapid_small_txns: 5,
        new_geo_large_amount: 10,
        card_absent_high_value: 12,
        merchant_spike: 6,
        account_takeover: 20,
        cash_out_burst: 18,
      },
      ...opts,
    };
  }

  private categorize(score: number): RiskCategory {
    const t = this.opts.thresholds!;
    if (score >= t.critical) return 'critical';
    if (score >= t.high) return 'high';
    if (score >= t.medium) return 'medium';
    return 'low';
  }

  score(anomaly: AnomalyScores, patterns: PatternMatch[]): RiskScore {
    // base score from ensemble anomaly
    let score = Math.round((anomaly.ensemble ?? 0) * 100);
    const reasons: string[] = [];

    // pattern boosts
    for (const pm of patterns) {
      if (pm.pattern === 'none') continue;
      const boost = this.opts.patternBoosts?.[pm.pattern as FraudPattern] ?? 0;
      // proportional to confidence
      score += Math.round(boost * pm.confidence);
      reasons.push(`${pm.pattern} (${Math.round(pm.confidence * 100)}%)`);
      for (const ind of pm.indicators) reasons.push(`• ${ind}`);
    }

    // clamp
    score = Math.max(0, Math.min(100, score));
    const category = this.categorize(score);
    return { score, category, reasons };
  }
}