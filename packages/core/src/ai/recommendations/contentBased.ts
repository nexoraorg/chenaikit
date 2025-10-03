// packages/core/src/ai/recommendations/contentBased.ts
import { Item, Interaction, Recommendation, UserProfile } from './types';

function dotSparse(a: Record<string, number>, b: Record<string, number>) {
  let s = 0;
  for (const k in a) {
    if (b[k] !== undefined) s += a[k] * b[k];
  }
  return s;
}

function normSparse(a: Record<string, number>) {
  let s = 0;
  for (const k in a) s += a[k] * a[k];
  return Math.sqrt(s) || 1e-12;
}

function cosineSparse(a: Record<string, number>, b: Record<string, number>) {
  return dotSparse(a, b) / (normSparse(a) * normSparse(b));
}

export class ContentBasedRecommender {
  private items: Item[] = [];

  private itemVectors = new Map<string, Record<string, number>>();

  private docFreq: Record<string, number> = {};

  fit(items: Item[]) {
    this.items = items;
    this.itemVectors.clear();
    this.docFreq = {};

    for (const it of items) {
      const vec = this.encodeItemFeatures(it);
      this.itemVectors.set(it.id, vec);

      for (const key of Object.keys(vec)) {
        this.docFreq[key] = (this.docFreq[key] || 0) + 1;
      }
    }

    const N = items.length;
    if (N > 0) {
      for (const [id, vec] of this.itemVectors) {
        for (const k of Object.keys(vec)) {
          const idf = Math.log(1 + N / (1 + (this.docFreq[k] || 1)));
          vec[k] *= idf;
        }
      }
    }
  }

  private encodeItemFeatures(item: Item): Record<string, number> {
    const out: Record<string, number> = {};
    if (!item.features) return out;
    for (const [k, v] of Object.entries(item.features)) {
      if (Array.isArray(v)) {
        for (const vv of v) {
          const token = `${k}:${String(vv)}`;
          out[token] = (out[token] || 0) + 1;
        }
      } else if (typeof v === 'string') {
        const token = `${k}:${v}`;
        out[token] = (out[token] || 0) + 1;
      } else if (typeof v === 'number') {
        out[k] = (out[k] || 0) + v;
      } else {
        const token = `${k}:${String(v)}`;
        out[token] = (out[token] || 0) + 1;
      }
    }
    return out;
  }

  buildUserProfile(userId: string, interactions: Interaction[]): UserProfile {
    const userInteractions = interactions.filter((it) => it.userId === userId);
    const profile: Record<string, number> = {};
    let totalWeight = 0;
    for (const it of userInteractions) {
      const itemVec = this.itemVectors.get(it.itemId);
      if (!itemVec) continue;
      const weight = typeof it.rating === 'number' ? it.rating : 1;
      totalWeight += weight;
      for (const k of Object.keys(itemVec)) {
        profile[k] = (profile[k] || 0) + itemVec[k] * weight;
      }
    }
    if (totalWeight > 0) {
      for (const k of Object.keys(profile)) profile[k] = profile[k] / totalWeight;
    }
    return { userId, vector: profile };
  }

  recommendForUser(
    userId: string,
    interactions: Interaction[],
    topN = 10
  ): Recommendation[] {
    const profile = this.buildUserProfile(userId, interactions);

    const noProfile = Object.keys(profile.vector).length === 0;
    if (noProfile) {

        return this.items
        .slice()
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, topN)
        .map((it) => ({ itemId: it.id, score: it.popularity || 0 }));
    }

    const seenItemIds = new Set(interactions.filter((it) => it.userId === userId).map((it) => it.itemId));
    const scores: Recommendation[] = [];
    for (const it of this.items) {
      if (seenItemIds.has(it.id)) continue;
      const vec = this.itemVectors.get(it.id) || {};
      const sc = cosineSparse(profile.vector, vec);
      scores.push({ itemId: it.id, score: sc });
    }
    return scores.sort((a, b) => b.score - a.score).slice(0, topN);
  }
}
