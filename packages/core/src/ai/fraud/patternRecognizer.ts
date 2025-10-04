import { PatternFinding, Transaction } from './types';

function burstScore(vel1m: number, vel5m: number): number {
  const base = vel1m + Math.max(0, vel5m - vel1m);
  return Math.min(1, base / 10);
}

function geoVelocityScore(kmph: number): number {
  if (kmph <= 200) return 0; // safe
  if (kmph >= 1000) return 1;
  return (kmph - 200) / (1000 - 200);
}

function structuringScore(amount: number, prevBalance?: number): number {
  // Many small amounts relative to balance can be structuring
  const ratio = prevBalance ? amount / Math.max(1, prevBalance) : 0;
  if (ratio < 0.005 && amount > 50) return Math.min(1, amount / 500);
  return 0;
}

export class PatternRecognizer {
  recognize(featureNames: string[], features: number[], tx: Transaction): PatternFinding[] {
    const out: PatternFinding[] = [];

    const get = (name: string) => {
      const idx = featureNames.indexOf(name);
      return idx >= 0 ? features[idx] : 0;
    };

    // Burst activity
    const vel1 = get('velocity_1m');
    const vel5 = get('velocity_5m');
    const burst = burstScore(vel1, vel5);
    if (burst > 0) out.push({ name: 'burst_activity', score: burst, reason: `High transaction velocity: ${vel1}/1m, ${vel5}/5m` });

    // Geo velocity
    const kmph = get('geo_speed_kmph');
    const geo = geoVelocityScore(kmph);
    if (geo > 0) out.push({ name: 'impossible_travel', score: geo, reason: `Geo velocity ${kmph.toFixed(1)} km/h` });

    // Device change
    const devChanged = get('device_changed');
    if (devChanged > 0) out.push({ name: 'device_change', score: 0.6, reason: 'Transaction from new device' });

    // Merchant novelty
    const novelty = get('merchant_novelty');
    if (novelty > 0.7) out.push({ name: 'merchant_novelty', score: novelty, reason: 'Unseen merchant for account' });

    // High-risk country
    const countryRisk = get('country_risk');
    if (countryRisk > 0) out.push({ name: 'high_risk_country', score: 0.8, reason: `Transaction in high-risk country: ${tx.country}` });

    // Time-of-day anomaly
    const hourDev = get('hour_deviation');
    if (hourDev > 0.8) out.push({ name: 'odd_hour', score: hourDev, reason: 'Unusual transaction hour for user' });

    // Amount structuring
    const struct = structuringScore(tx.amount, tx.previousBalance);
    if (struct > 0) out.push({ name: 'amount_structuring', score: struct, reason: 'Multiple small transfers indicative of structuring' });

    // Channel risk
    const chRisk = get('channel_risk');
    if (chRisk > 0.9) out.push({ name: 'high_risk_channel', score: 0.5, reason: `Channel ${tx.channel} has elevated risk` });

    return out;
  }
}