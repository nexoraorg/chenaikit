import { FeatureExtractorOptions, FeatureVector, Transaction } from './types';

type AccountHistory = {
  lastTx?: Transaction;
  txTimestamps: number[]; // recent timestamps
  amounts: number[]; // recent amounts
  merchantCounts: Map<string, number>;
  hourHistogram: number[]; // 24 buckets
};

const EARTH_RADIUS_KM = 6371;

function haversine(lat1?: number, lon1?: number, lat2?: number, lon2?: number): number | undefined {
  if (
    lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined
  )
    return undefined;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
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

const HIGH_RISK_COUNTRIES = new Set<string>([
  // Example list, extend as necessary
  'NG', 'UA', 'RU', 'IR', 'IQ', 'AF', 'SY', 'YE'
]);

export class FeatureExtractor {
  private opts: Required<FeatureExtractorOptions>;
  private history: Map<string, AccountHistory> = new Map();

  constructor(opts?: FeatureExtractorOptions) {
    this.opts = {
      velocityWindowsMinutes: opts?.velocityWindowsMinutes ?? [1, 5, 60],
      maxHistoryPerAccount: opts?.maxHistoryPerAccount ?? 500,
    };
  }

  private getHistory(accountId: string): AccountHistory {
    let h = this.history.get(accountId);
    if (!h) {
      h = {
        txTimestamps: [],
        amounts: [],
        merchantCounts: new Map(),
        hourHistogram: new Array(24).fill(0),
      };
      this.history.set(accountId, h);
    }
    return h;
  }

  private updateHistory(tx: Transaction) {
    const h = this.getHistory(tx.accountId);
    h.lastTx = tx;
    h.txTimestamps.push(tx.timestamp);
    h.amounts.push(tx.amount);
    if (tx.merchantId) h.merchantCounts.set(tx.merchantId, (h.merchantCounts.get(tx.merchantId) || 0) + 1);
    const hour = new Date(tx.timestamp).getHours();
    h.hourHistogram[hour]++;
    // Trim history
    const max = this.opts.maxHistoryPerAccount;
    if (h.txTimestamps.length > max) h.txTimestamps.splice(0, h.txTimestamps.length - max);
    if (h.amounts.length > max) h.amounts.splice(0, h.amounts.length - max);
    if (h.merchantCounts.size > max) {
      // simple decay: reduce counts
      for (const key of h.merchantCounts.keys()) {
        h.merchantCounts.set(key, Math.max(0, Math.floor((h.merchantCounts.get(key) || 0) * 0.9)));
      }
    }
    // hour histogram decay
    for (let i = 0; i < 24; i++) h.hourHistogram[i] = Math.floor(h.hourHistogram[i] * 0.995);
  }

  private velocityCounts(h: AccountHistory, now: number) {
    const counts: number[] = [];
    for (const w of this.opts.velocityWindowsMinutes) {
      const windowMs = w * 60 * 1000;
      const c = h.txTimestamps.filter((t) => now - t <= windowMs).length;
      counts.push(c);
    }
    return counts;
  }

  extract(tx: Transaction): FeatureVector {
    const start = Date.now();
    const h = this.getHistory(tx.accountId);
    const names: string[] = [];
    const values: number[] = [];

    // Amount z-score vs account history
    const m = mean(h.amounts);
    const s = std(h.amounts) || 1e-6;
    names.push('amount_z');
    values.push((tx.amount - m) / s);

    // Velocity features
    const counts = this.velocityCounts(h, tx.timestamp);
    for (let i = 0; i < counts.length; i++) {
      names.push(`velocity_${this.opts.velocityWindowsMinutes[i]}m`);
      values.push(counts[i]);
    }

    // Time since last transaction
    const dt = h.lastTx ? (tx.timestamp - h.lastTx.timestamp) / 1000 : 1e6;
    names.push('seconds_since_last_tx');
    values.push(dt);

    // Merchant novelty
    const merchantFreq = tx.merchantId ? h.merchantCounts.get(tx.merchantId) || 0 : 0;
    names.push('merchant_novelty');
    values.push(merchantFreq === 0 ? 1 : 1 / Math.sqrt(merchantFreq + 1));

    // Hour-of-day deviation
    const hour = new Date(tx.timestamp).getHours();
    const totalHours = h.hourHistogram.reduce((a, b) => a + b, 0) || 1;
    const hourProb = h.hourHistogram[hour] / totalHours;
    names.push('hour_deviation');
    values.push(1 - hourProb);

    // Geo-velocity km per hour
    const distKm = haversine(h.lastTx?.lat, h.lastTx?.lon, tx.lat, tx.lon);
    const hours = h.lastTx ? Math.max(1e-6, (tx.timestamp - h.lastTx.timestamp) / (3600 * 1000)) : 0;
    const kmph = distKm !== undefined ? distKm / hours : 0;
    names.push('geo_speed_kmph');
    values.push(kmph);

    // Device change indicator
    const deviceChanged = h.lastTx?.deviceId && tx.deviceId && h.lastTx.deviceId !== tx.deviceId ? 1 : 0;
    names.push('device_changed');
    values.push(deviceChanged);

    // Channel risk weight
    const channelRisk = tx.channel === 'online' ? 1 : tx.channel === 'atm' ? 0.7 : tx.channel === 'transfer' ? 0.8 : 0.5;
    names.push('channel_risk');
    values.push(channelRisk);

    // Country risk indicator
    const countryRisk = tx.country && HIGH_RISK_COUNTRIES.has(tx.country) ? 1 : 0;
    names.push('country_risk');
    values.push(countryRisk);

    // Balance impact ratio
    const balanceImpact = tx.previousBalance ? tx.amount / Math.max(1, tx.previousBalance) : 0;
    names.push('balance_impact_ratio');
    values.push(balanceImpact);

    // Update history after extracting features
    this.updateHistory(tx);

    const fv: FeatureVector = {
      id: tx.id,
      accountId: tx.accountId,
      features: values,
      featureNames: names,
    };

    // Ensure fast execution
    const elapsed = Date.now() - start;
    if (elapsed > 50) {
      // If extraction slows, apply more aggressive decay to history to keep it light
      const hist = this.getHistory(tx.accountId);
      hist.txTimestamps = hist.txTimestamps.slice(-Math.floor(this.opts.maxHistoryPerAccount / 2));
      hist.amounts = hist.amounts.slice(-Math.floor(this.opts.maxHistoryPerAccount / 2));
    }

    return fv;
  }
}