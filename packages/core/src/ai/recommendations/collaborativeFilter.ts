// packages/core/src/ai/recommendations/collaborativeFilter.ts
import { Interaction, Recommendation } from './types';

type NumMatrix = number[][];

function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]) {
  return Math.sqrt(dot(a, a)) || 1e-12;
}

function cosine(a: number[], b: number[]) {
  return dot(a, b) / (norm(a) * norm(b));
}

export class CollaborativeFilter {
  private users: string[] = [];
  private items: string[] = [];
  private userIndex = new Map<string, number>();
  private itemIndex = new Map<string, number>();
  private userItemMatrix: NumMatrix = []; 
  private itemVectorsCache = new Map<number, number[]>();
  private simCache = new Map<string, number>(); 

  fit(interactions: Interaction[]) {
    const usersSet = new Set<string>();
    const itemsSet = new Set<string>();
    interactions.forEach((it) => {
      usersSet.add(it.userId);
      itemsSet.add(it.itemId);
    });
    this.users = Array.from(usersSet);
    this.items = Array.from(itemsSet);
    this.userIndex = new Map(this.users.map((u, i) => [u, i]));
    this.itemIndex = new Map(this.items.map((it, i) => [it, i]));

    const U = this.users.length;
    const I = this.items.length;
    this.userItemMatrix = Array.from({ length: U }, () => Array(I).fill(0));

    interactions.forEach((it) => {
      const u = this.userIndex.get(it.userId)!;
      const i = this.itemIndex.get(it.itemId)!;
      const r = typeof it.rating === 'number' ? it.rating : 1;
      this.userItemMatrix[u][i] = Math.max(this.userItemMatrix[u][i], r);
    });

    this.itemVectorsCache.clear();
    this.simCache.clear();
  }

  private getItemVector(itemIdx: number) {
    const cached = this.itemVectorsCache.get(itemIdx);
    if (cached) return cached;
    const col = this.userItemMatrix.map((row) => row[itemIdx]);
    this.itemVectorsCache.set(itemIdx, col);
    return col;
  }

  private simKey(a: number, b: number) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private itemSimilarity(aIdx: number, bIdx: number) {
    const key = this.simKey(aIdx, bIdx);
    if (this.simCache.has(key)) return this.simCache.get(key)!;
    const a = this.getItemVector(aIdx);
    const b = this.getItemVector(bIdx);
    const s = cosine(a, b);
    this.simCache.set(key, s);
    return s;
  }

  recommendForUser(userId: string, topN = 10): Recommendation[] {
    if (!this.userIndex.has(userId)) return [];

    const uIdx = this.userIndex.get(userId)!;
    const userRow = this.userItemMatrix[uIdx];

    const seenItems = new Set<number>();
    for (let c = 0; c < userRow.length; c++) {
      if (userRow[c] > 0) seenItems.add(c);
    }
    const scores: Map<number, number> = new Map();

    for (let j = 0; j < this.items.length; j++) {
      if (seenItems.has(j)) continue; 
      let num = 0;
      let denom = 0;

      for (const i of seenItems) {
        const sim = this.itemSimilarity(j, i);
        num += sim * userRow[i];
        denom += Math.abs(sim);
      }
      const score = denom > 0 ? num / denom : 0;
      scores.set(j, score);
    }

    const recs: Recommendation[] = Array.from(scores.entries())
      .map(([itemIdx, score]) => ({
        itemId: this.items[itemIdx],
        score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    return recs;
  }

  getTopKSimilarItems(itemId: string, k = 10) {
    const idx = this.itemIndex.get(itemId);
    if (idx === undefined) return [];
    const sims: { item: string; sim: number }[] = [];
    for (let j = 0; j < this.items.length; j++) {
      if (j === idx) continue;
      sims.push({ item: this.items[j], sim: this.itemSimilarity(idx, j) });
    }
    return sims.sort((a, b) => b.sim - a.sim).slice(0, k);
  }
}
