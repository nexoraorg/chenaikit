import { FeatureExtractorOptions, RawTransaction, TransactionFeatures } from './types';

type AccountState = {
  amounts: number[]; // recent amounts
  timestamps: number[]; // epoch ms
  byMerchant: Map<string, number>;
  byCategory: Map<string, number>;
  lastTxnAt?: number;
};

const MAX_WINDOW = 500; // cap for memory

export class FeatureExtractor {
  private stateByAccount = new Map<string, AccountState>();
  private opts: FeatureExtractorOptions;

  constructor(opts: FeatureExtractorOptions = {}) {
    this.opts = opts;
  }

  private getState(accountId: string): AccountState {
    let s = this.stateByAccount.get(accountId);
    if (!s) {
      s = { amounts: [], timestamps: [], byMerchant: new Map(), byCategory: new Map() };
      this.stateByAccount.set(accountId, s);
    }
    return s;
  }

  private rollingStats(values: number[]): { mean: number; std: number } {
    if (!values.length) return { mean: 0, std: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const varv = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
    return { mean, std: Math.sqrt(varv) };
  }

  private geoDistanceKm(a?: { lat?: number; lon?: number }, b?: { lat?: number; lon?: number }): number | undefined {
    if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return undefined;
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aHarv = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
    return R * c;
  }

  extract(tx: RawTransaction): TransactionFeatures {
    const s = this.getState(tx.accountId);
    const absAmount = Math.abs(tx.amount);
    const isDebit = tx.amount < 0;

    // Update rolling state first (for latency and simplicity)
    s.amounts.push(absAmount);
    if (s.amounts.length > MAX_WINDOW) s.amounts.shift();
    const ts = tx.timestamp.getTime();
    s.timestamps.push(ts);
    if (s.timestamps.length > MAX_WINDOW) s.timestamps.shift();
    if (tx.merchant) s.byMerchant.set(tx.merchant, (s.byMerchant.get(tx.merchant) || 0) + 1);
    if (tx.category) s.byCategory.set(tx.category, (s.byCategory.get(tx.category) || 0) + 1);

    const { mean, std } = this.rollingStats(s.amounts);
    const amountZ = std ? (absAmount - mean) / std : 0;

    const hourOfDay = tx.timestamp.getHours();
    const dayOfWeek = tx.timestamp.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const timeSinceLastTxnSec = s.lastTxnAt != null ? Math.max(0, (ts - s.lastTxnAt) / 1000) : undefined;
    s.lastTxnAt = ts;

    const unusualHourRanges = this.opts.unusualHourRange || [{ start: 0, end: 5 }];
    const unusualHour = unusualHourRanges.some((r) => hourOfDay >= r.start && hourOfDay <= r.end);

    // Location flags
    const hasGeo = !!tx.location && (tx.location?.lat != null || tx.location?.lon != null);
    const countryChanged = tx.location?.country ? tx.metadata?.prevCountry && tx.metadata.prevCountry !== tx.location.country : false;
    const cityChanged = tx.location?.city ? tx.metadata?.prevCity && tx.metadata.prevCity !== tx.location.city : false;
    const geoDistanceKm = this.geoDistanceKm(
      tx.metadata?.prevCoords as any,
      tx.location as any
    );
    const unusualLocation = geoDistanceKm != null && geoDistanceKm > (this.opts.geoDistanceThresholdKm ?? 1000);

    const channel = tx.channel || 'pos';
    const unusualChannel = channel === 'online' && isDebit && absAmount > (mean + 2 * std);

    const merchantKnown = tx.merchant ? (s.byMerchant.get(tx.merchant) || 0) > 2 : false;
    const categoryKnown = tx.category ? (s.byCategory.get(tx.category) || 0) > 2 : false;
    const merchantTxnCount = tx.merchant ? s.byMerchant.get(tx.merchant) || 0 : undefined;
    const categoryTxnCount = tx.category ? s.byCategory.get(tx.category) || 0 : undefined;

    // Velocity features (approximate)
    const nowSec = ts / 1000;
    const oneHourAgo = nowSec - 3600;
    const twentyFourAgo = nowSec - 86400;
    const rollingTxnCount1h = s.timestamps.filter((t) => t / 1000 >= oneHourAgo).length;
    const rollingTxnCount24h = s.timestamps.filter((t) => t / 1000 >= twentyFourAgo).length;
    const rollingAmount24h = s.timestamps.reduce((sum, t, i) => (t / 1000 >= twentyFourAgo ? sum + s.amounts[i] : sum), 0);

    return {
      absAmount,
      isDebit,
      amountZScore: amountZ,
      amountRollingMean: mean,
      amountRollingStd: std,
      hourOfDay,
      dayOfWeek,
      isWeekend,
      timeSinceLastTxnSec,
      hasGeo,
      geoDistanceKm,
      countryChanged,
      cityChanged,
      channel,
      merchantKnown,
      categoryKnown,
      merchantTxnCount,
      categoryTxnCount,
      rollingTxnCount1h,
      rollingTxnCount24h,
      rollingAmount24h,
      unusualHour,
      unusualLocation,
      unusualChannel,
    };
  }
}