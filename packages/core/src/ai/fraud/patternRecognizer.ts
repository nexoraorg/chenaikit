import { FraudPattern, PatternMatch, TransactionFeatures } from './types';

export class PatternRecognizer {
  recognize(features: TransactionFeatures): PatternMatch[] {
    const matches: PatternMatch[] = [];

    // rapid small txns: many txns in 1h and small amounts
    if ((features.rollingTxnCount1h ?? 0) >= 5 && (features.absAmount ?? 0) < (features.amountRollingMean ?? 0)) {
      matches.push({
        pattern: 'rapid_small_txns',
        confidence: Math.min(1, 0.5 + (features.rollingTxnCount1h! - 5) * 0.1),
        indicators: [
          `High txn velocity in 1h: ${features.rollingTxnCount1h}`,
          `Small amount relative to mean: ${features.absAmount} < ${features.amountRollingMean}`,
        ],
      });
    }

    // new geo large amount
    if (features.unusualLocation && (features.absAmount ?? 0) > (features.amountRollingMean ?? 0) * 2) {
      matches.push({
        pattern: 'new_geo_large_amount',
        confidence: Math.min(1, 0.6 + ((features.geoDistanceKm ?? 0) / 1000) * 0.1),
        indicators: [
          `Unusual location distance: ${features.geoDistanceKm?.toFixed(2)} km`,
          `Amount spike: ${features.absAmount} vs mean ${features.amountRollingMean}`,
        ],
      });
    }

    // card-absent high value (online debit beyond threshold)
    if (features.unusualChannel && features.isDebit && (features.absAmount ?? 0) > (features.amountRollingMean ?? 0) * 1.5) {
      matches.push({
        pattern: 'card_absent_high_value',
        confidence: 0.7,
        indicators: [
          'Online debit flagged as unusual channel',
          `High amount: ${features.absAmount}`,
        ],
      });
    }

    // merchant spike
    if (!features.merchantKnown && (features.absAmount ?? 0) > (features.amountRollingMean ?? 0) * 1.2) {
      matches.push({
        pattern: 'merchant_spike',
        confidence: 0.6,
        indicators: [
          'New or rare merchant for account',
          `Amount above mean`,
        ],
      });
    }

    // account takeover: unusual hour + unusual location + high velocity
    if (features.unusualHour && features.unusualLocation && (features.rollingTxnCount24h ?? 0) > 10) {
      matches.push({
        pattern: 'account_takeover',
        confidence: Math.min(1, 0.5 + ((features.rollingTxnCount24h ?? 0) - 10) * 0.05),
        indicators: ['Odd hour', 'Location anomaly', 'High txn velocity'],
      });
    }

    // cash out burst: many large debit withdrawals in short time (atm or transfer)
    if (features.channel && (features.channel === 'atm' || features.channel === 'transfer') && features.isDebit && (features.absAmount ?? 0) > (features.amountRollingMean ?? 0) * 1.5 && (features.rollingTxnCount1h ?? 0) >= 3) {
      matches.push({
        pattern: 'cash_out_burst',
        confidence: 0.8,
        indicators: ['ATM/transfer channel', 'Large debit', 'Short-time burst'],
      });
    }

    if (matches.length === 0) {
      matches.push({ pattern: 'none', confidence: 0.0, indicators: [] });
    }

    return matches;
  }
}