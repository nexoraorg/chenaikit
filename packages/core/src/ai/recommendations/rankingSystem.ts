// packages/core/src/ai/recommendations/rankingSystem.ts
import { Recommendation } from './types';

export function normalizeScores(values: number[]) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) < 1e-12) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}

export function applyBusinessBoosts(recs: Recommendation[], boosts: Record<string, number>) {
  return recs.map((r) => ({ ...r, score: r.score * (boosts[r.itemId] ?? 1) })).sort((a, b) => b.score - a.score);
}

export function mmr(
  recs: Recommendation[],
  k: number,
  lambda = 0.6,
  itemSimilarities: (a: string, b: string) => number = () => 0
): Recommendation[] {
  if (recs.length <= k) return recs.slice(0, k);

  const candidates = recs.slice().sort((a, b) => b.score - a.score);
  const selected: Recommendation[] = [];
  while (selected.length < k && candidates.length > 0) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
 
      const rel = c.score;

      let maxSim = 0;
      for (const s of selected) {
        maxSim = Math.max(maxSim, itemSimilarities(c.itemId, s.itemId));
      }
      const mmrScore = lambda * rel - (1 - lambda) * maxSim;
      if (mmrScore > bestVal) {
        bestVal = mmrScore;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    selected.push(candidates.splice(bestIdx, 1)[0]);
  }
  return selected;
}

export function precisionAtK(recs: string[], groundTruth: Set<string>, k: number) {
  const topk = recs.slice(0, k);
  let hit = 0;
  for (const id of topk) if (groundTruth.has(id)) hit++;
  return hit / k;
}

export function dcgAtK(recs: string[], groundTruth: Set<string>, k: number) {
  let dcg = 0;
  for (let i = 0; i < Math.min(k, recs.length); i++) {
    const id = recs[i];
    const rel = groundTruth.has(id) ? 1 : 0;
    dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  }
  return dcg;
}

export function ndcgAtK(recs: string[], groundTruth: Set<string>, k: number) {
  const dcg = dcgAtK(recs, groundTruth, k);

  const idealRelCount = Math.min(k, groundTruth.size);
  let idcg = 0;
  for (let i = 0; i < idealRelCount; i++) {
    idcg += (Math.pow(2, 1) - 1) / Math.log2(i + 2);
  }
  return idcg === 0 ? 0 : dcg / idcg;
}


export class ABTestManager {
  private assignments = new Map<string, string>();

  private hash(s: string) {

    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  }

  assign(userId: string, experimentKey: string, variants: string[]) {
    const key = `${userId}:${experimentKey}`;
    if (this.assignments.has(key)) return this.assignments.get(key)!;
    const h = this.hash(key);
    const idx = h % variants.length;
    const v = variants[idx];
    this.assignments.set(key, v);
    return v;
  }

  record(event: string, payload: any) {
    console.log(`ABTest event: ${event}`, payload);
  }
}
