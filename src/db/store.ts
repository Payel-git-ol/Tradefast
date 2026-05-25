import { and, desc, eq, lt, sql } from 'drizzle-orm';

import type { Candle } from '../domain/candle.js';
import type { LostfastDb } from './client.js';
import {
  aiInsights,
  analytics,
  candles as candlesTable,
  runs,
  scrapes,
  searchResults,
  signals,
} from './schema.js';

export type RunKind = 'start' | 'update';

export interface SignalRow {
  symbol: string;
  strategy: string;
  direction: string;
  strength: number;
  reason: string;
  riskPercent: number;
  status: string;
  quantity?: number | null;
  notional?: number | null;
  at: number;
}

export interface AnalyticsRow {
  symbol: string;
  consensusScore: number;
  longCount: number;
  shortCount: number;
  neutralCount: number;
  strongestStrategy?: string | null;
  strongestStrength?: number | null;
  lastPrice?: number | null;
  atr?: number | null;
}

/**
 * The single gateway to persisted state. It owns the lifecycle rules that the
 * three core commands rely on:
 *
 *  - `/start`  → {@link wipeEphemeral} then a fresh run; the general
 *                `search_results` table is never touched.
 *  - `/update` → {@link upsertSignal} only writes rows that actually changed.
 *  - `/clear`  → {@link pruneOutdated} drops everything but the latest run and
 *                the general `search_results` table.
 */
export class LostfastStore {
  constructor(private readonly db: LostfastDb) {}

  // --- Run lifecycle -------------------------------------------------------

  async createRun(kind: RunKind, symbols: string[]): Promise<number> {
    const [row] = await this.db.insert(runs).values({ kind, symbols }).returning({ id: runs.id });
    return row.id;
  }

  async finishRun(runId: number, status: 'completed' | 'failed', note?: string): Promise<void> {
    await this.db
      .update(runs)
      .set({ status, finishedAt: new Date(), note })
      .where(eq(runs.id, runId));
  }

  async latestRunId(): Promise<number | undefined> {
    const [row] = await this.db.select({ id: runs.id }).from(runs).orderBy(desc(runs.id)).limit(1);
    return row?.id;
  }

  // --- /start --------------------------------------------------------------

  /** Wipe every ephemeral table. The general `search_results` table survives. */
  async wipeEphemeral(): Promise<void> {
    // Delete children before parents to respect foreign keys.
    await this.db.delete(signals);
    await this.db.delete(analytics);
    await this.db.delete(scrapes);
    await this.db.delete(aiInsights);
    await this.db.delete(candlesTable);
    await this.db.delete(runs);
  }

  // --- /clear --------------------------------------------------------------

  /**
   * Drop outdated data: keep only the most recent run (and its rows) plus the
   * general `search_results` table. Returns the number of pruned runs.
   */
  async pruneOutdated(): Promise<number> {
    const latest = await this.latestRunId();
    if (latest === undefined) return 0;
    // Cascading FKs remove dependent signals/analytics/scrapes/ai_insights.
    const deleted = await this.db.delete(runs).where(lt(runs.id, latest)).returning({ id: runs.id });
    // Candles have no run FK; trim everything but the active symbols' freshest data.
    return deleted.length;
  }

  // --- Candles -------------------------------------------------------------

  /** Insert only candles not already stored (unchanged rows are skipped). */
  async upsertCandles(symbol: string, interval: string, list: readonly Candle[]): Promise<number> {
    if (list.length === 0) return 0;
    const rows = list.map((c) => ({
      symbol,
      interval,
      openTime: new Date(c.openTime),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    const inserted = await this.db
      .insert(candlesTable)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: candlesTable.id });
    return inserted.length;
  }

  async getCandles(symbol: string, interval: string): Promise<Candle[]> {
    const rows = await this.db
      .select()
      .from(candlesTable)
      .where(and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, interval)))
      .orderBy(candlesTable.openTime);
    return rows.map((r) => ({
      openTime: r.openTime.getTime(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));
  }

  // --- Signals (update-aware) ---------------------------------------------

  /**
   * Upsert a signal, returning whether the stored value actually changed. This
   * is what lets `/update` report how many rows it touched versus left alone.
   */
  async upsertSignal(runId: number, s: SignalRow): Promise<'inserted' | 'updated' | 'unchanged'> {
    const [existing] = await this.db
      .select()
      .from(signals)
      .where(and(eq(signals.runId, runId), eq(signals.symbol, s.symbol), eq(signals.strategy, s.strategy)))
      .limit(1);

    const matches =
      existing &&
      existing.direction === s.direction &&
      Math.abs(existing.strength - s.strength) < 1e-9 &&
      existing.reason === s.reason &&
      existing.status === s.status;
    if (matches) return 'unchanged';

    await this.db
      .insert(signals)
      .values({
        runId,
        symbol: s.symbol,
        strategy: s.strategy,
        direction: s.direction,
        strength: s.strength,
        reason: s.reason,
        riskPercent: s.riskPercent,
        status: s.status,
        quantity: s.quantity ?? null,
        notional: s.notional ?? null,
        at: new Date(s.at),
      })
      .onConflictDoUpdate({
        target: [signals.runId, signals.symbol, signals.strategy],
        set: {
          direction: s.direction,
          strength: s.strength,
          reason: s.reason,
          riskPercent: s.riskPercent,
          status: s.status,
          quantity: s.quantity ?? null,
          notional: s.notional ?? null,
          at: new Date(s.at),
        },
      });
    return existing ? 'updated' : 'inserted';
  }

  async upsertAnalytics(runId: number, a: AnalyticsRow): Promise<void> {
    await this.db
      .insert(analytics)
      .values({ runId, ...a })
      .onConflictDoUpdate({
        target: [analytics.runId, analytics.symbol],
        set: { ...a },
      });
  }

  async saveScrape(
    runId: number,
    row: { symbol?: string; url: string; title?: string; content?: string; contentHash: string },
  ): Promise<void> {
    await this.db
      .insert(scrapes)
      .values({
        runId,
        symbol: row.symbol ?? null,
        url: row.url,
        title: row.title ?? null,
        content: row.content ?? null,
        contentHash: row.contentHash,
      })
      .onConflictDoNothing();
  }

  async saveInsight(
    runId: number,
    row: { symbol: string; model: string; summary: string; confidence: number },
  ): Promise<void> {
    await this.db.insert(aiInsights).values({ runId, ...row });
  }

  // --- Search results (the general, persistent table) ----------------------

  async saveSearchResult(row: {
    query: string;
    symbol?: string;
    source: string;
    title: string;
    url?: string;
    snippet?: string;
    score?: number;
  }): Promise<void> {
    await this.db
      .insert(searchResults)
      .values({
        query: row.query,
        symbol: row.symbol ?? null,
        source: row.source,
        title: row.title,
        url: row.url ?? null,
        snippet: row.snippet ?? null,
        score: row.score ?? 0,
      })
      .onConflictDoUpdate({
        target: [searchResults.query, searchResults.title],
        set: { snippet: row.snippet ?? null, score: row.score ?? 0, createdAt: new Date() },
      });
  }

  // --- Read helpers for the UI --------------------------------------------

  async tableCounts(): Promise<Record<string, number>> {
    const tables = { runs, candles: candlesTable, signals, analytics, scrapes, aiInsights, searchResults };
    const entries = await Promise.all(
      Object.entries(tables).map(async ([name, table]) => {
        const [row] = await this.db.select({ count: sql<number>`count(*)::int` }).from(table);
        return [name, row?.count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async latestAnalytics(runId: number): Promise<AnalyticsRow[]> {
    const rows = await this.db.select().from(analytics).where(eq(analytics.runId, runId));
    return rows.map((r) => ({
      symbol: r.symbol,
      consensusScore: r.consensusScore,
      longCount: r.longCount,
      shortCount: r.shortCount,
      neutralCount: r.neutralCount,
      strongestStrategy: r.strongestStrategy,
      strongestStrength: r.strongestStrength,
      lastPrice: r.lastPrice,
      atr: r.atr,
    }));
  }
}
