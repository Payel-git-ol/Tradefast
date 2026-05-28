import type { TradefastStore } from '../db/store.js';
import type { NewsSource } from './news-crawler.js';

export interface SourceRating {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  kind: string;
  credibilityScore: number;
  predictionsMade: number;
  predictionsCorrect: number;
  loudClaims: number;
  lastPredictionAt?: string;
  lastUpdated: string;
}

export class SourceRatingService {
  constructor(private readonly store: TradefastStore) {}

  async getRating(sourceId: string): Promise<SourceRating | undefined> {
    return this.store.getSourceRating(sourceId);
  }

  async getAllRatings(): Promise<SourceRating[]> {
    return this.store.getAllSourceRatings();
  }

  async seedSources(sources: readonly NewsSource[]): Promise<void> {
    for (const source of sources) {
      if (source.enabled === false) continue;
      const existing = await this.store.getSourceRating(source.id);
      if (existing) continue;
      await this.store.upsertSourceRating({
        sourceId: source.id,
        sourceTitle: source.title,
        sourceUrl: source.url,
        kind: source.kind,
        credibilityScore: 1.0,
        predictionsMade: 0,
        predictionsCorrect: 0,
        loudClaims: 0,
      });
    }
  }

  async recordPrediction(sourceId: string, outcome: 'correct' | 'incorrect'): Promise<SourceRating | undefined> {
    const rating = await this.store.getSourceRating(sourceId);
    if (!rating) return undefined;

    const predictionsMade = rating.predictionsMade + 1;
    const predictionsCorrect = rating.predictionsCorrect + (outcome === 'correct' ? 1 : 0);
    const delta = outcome === 'correct' ? 0.05 : -0.10;
    const credibilityScore = clampScore(rating.credibilityScore + delta);

    await this.store.updateSourceRating(sourceId, {
      credibilityScore,
      predictionsMade,
      predictionsCorrect,
      lastPredictionAt: new Date().toISOString(),
    });

    return { ...rating, credibilityScore, predictionsMade, predictionsCorrect, lastPredictionAt: new Date().toISOString(), lastUpdated: new Date().toISOString() };
  }

  async recordLoudClaim(sourceId: string): Promise<SourceRating | undefined> {
    const rating = await this.store.getSourceRating(sourceId);
    if (!rating) return undefined;

    const loudClaims = rating.loudClaims + 1;
    const credibilityScore = clampScore(rating.credibilityScore - 0.20);

    await this.store.updateSourceRating(sourceId, {
      credibilityScore,
      loudClaims,
    });

    return { ...rating, credibilityScore, loudClaims, lastUpdated: new Date().toISOString() };
  }

  async applyTimeDecay(): Promise<void> {
    const ratings = await this.store.getAllSourceRatings();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const rating of ratings) {
      if (!rating.lastPredictionAt) continue;
      const lastPrediction = new Date(rating.lastPredictionAt).getTime();
      if (now - lastPrediction > thirtyDays) {
        const decay = clampScore(rating.credibilityScore - 0.05);
        await this.store.updateSourceRating(rating.sourceId, { credibilityScore: decay });
      }
    }
  }

  async adjustGrade(sourceIdOrTitle: string, delta: number): Promise<SourceRating & { foundByTitle: boolean } | undefined> {
    const byId = await this.store.getSourceRating(sourceIdOrTitle);
    if (byId) {
      const credibilityScore = clampScore(byId.credibilityScore + delta);
      await this.store.updateSourceRating(byId.sourceId, { credibilityScore });
      return { ...byId, credibilityScore, lastUpdated: new Date().toISOString(), foundByTitle: false };
    }

    const all = await this.store.getAllSourceRatings();
    const match = all.find((r) => r.sourceTitle.toLowerCase().includes(sourceIdOrTitle.toLowerCase()));
    if (match) {
      const credibilityScore = clampScore(match.credibilityScore + delta);
      await this.store.updateSourceRating(match.sourceId, { credibilityScore });
      return { ...match, credibilityScore, lastUpdated: new Date().toISOString(), foundByTitle: true };
    }

    return undefined;
  }

  scoreLabel(score: number): string {
    if (score >= 0.9) return 'high';
    if (score >= 0.7) return 'medium';
    if (score >= 0.5) return 'low';
    return 'untrusted';
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
