// packages/core/src/ai/recommendations/hybridEngine.ts
import { CollaborativeFilter } from './collaborativeFilter';
import { ContentBasedRecommender } from './contentBased';
import { Item, Interaction, Recommendation } from './types';
import { normalizeScores } from './rankingSystem';


export interface HybridOptions {
  alpha?: number;
  coldStartMinInteractions?: number; 
}

export class HybridEngine {
  private cf: CollaborativeFilter;
  private cb: ContentBasedRecommender;
  private alpha: number;
  private coldStartMinInteractions: number;
  private lastItems: Item[] = [];
  private lastInteractions: Interaction[] = [];

  constructor(opts?: HybridOptions) {
    this.cf = new CollaborativeFilter();
    this.cb = new ContentBasedRecommender();
    this.alpha = opts?.alpha ?? 0.5;
    this.coldStartMinInteractions = opts?.coldStartMinInteractions ?? 3;
  }

  fit(items: Item[], interactions: Interaction[]) {
    this.lastItems = items;
    this.lastInteractions = interactions;
    this.cf.fit(interactions);
    this.cb.fit(items);
  }

  recommendForUser(userId: string, topN = 10): Recommendation[] {
    const userInteractions = this.lastInteractions.filter((it) => it.userId === userId);
    if (userInteractions.length < this.coldStartMinInteractions) {

        return this.cb.recommendForUser(userId, this.lastInteractions, topN);
    }

    const cfRecs = this.cf.recommendForUser(userId, Math.max(50, topN));
    const cbRecs = this.cb.recommendForUser(userId, this.lastInteractions, Math.max(50, topN));

    const scoreMap = new Map<string, { cf?: number; cb?: number }>();
    for (const r of cfRecs) scoreMap.set(r.itemId, { ...(scoreMap.get(r.itemId) || {}), cf: r.score });
    for (const r of cbRecs) scoreMap.set(r.itemId, { ...(scoreMap.get(r.itemId) || {}), cb: r.score });

    const cfScores = Array.from(scoreMap.entries()).map(([id, v]) => v.cf ?? 0);
    const cbScores = Array.from(scoreMap.entries()).map(([id, v]) => v.cb ?? 0);
    const normCf = normalizeScores(cfScores);
    const normCb = normalizeScores(cbScores);

    const ids = Array.from(scoreMap.keys());
    const final: Recommendation[] = ids.map((id, idx) => {
      const v = scoreMap.get(id)!;
      const sCf = v.cf === undefined ? 0 : normCf[idx];
      const sCb = v.cb === undefined ? 0 : normCb[idx];
      const combined = this.alpha * sCf + (1 - this.alpha) * sCb;
      return { itemId: id, score: combined };
    });

    return final.sort((a, b) => b.score - a.score).slice(0, topN);
  }


  updateWithFeedback(feedback: Interaction) {
    this.lastInteractions.push(feedback);

    this.fit(this.lastItems, this.lastInteractions);
  }
}
