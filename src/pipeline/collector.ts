import type { LostfastStore, RunKind } from '../db/store.js';
import { DEFAULT_PARAMETERS, type StrategyParameters } from '../domain/signal.js';
import { AnalyticsService, type SymbolAnalysis } from '../services/analytics.js';
import { createAdvisor, type AiAdvisor } from '../services/ai-advisor.js';
import { createMarketSource, type MarketDataSource } from '../services/market-data.js';
import { createScraper, type Scraper } from '../services/scraping.js';
import { KnowledgeBaseSearch, type SearchProvider } from '../services/search.js';

export interface CollectOptions {
  symbols: string[];
  interval?: string;
  limit?: number;
  params?: StrategyParameters;
  accountBalance?: number;
}

/** A single human-readable progress step, streamed to the UI as work proceeds. */
export interface ProgressEvent {
  phase: 'wipe' | 'fetch' | 'analyze' | 'persist' | 'search' | 'scrape' | 'advise' | 'done';
  symbol?: string;
  message: string;
  /** Completed steps out of {@link totalSteps}, for a progress bar. */
  step: number;
  totalSteps: number;
}

export interface SymbolReport {
  symbol: string;
  analysis: SymbolAnalysis;
  insight: string;
  candlesAdded: number;
  signalsInserted: number;
  signalsUpdated: number;
  signalsUnchanged: number;
  scrapesAdded: number;
}

export interface RunReport {
  runId: number;
  kind: RunKind;
  symbols: SymbolReport[];
  searchResults: number;
  durationMs: number;
}

export type ProgressListener = (event: ProgressEvent) => void;

/**
 * Orchestrates a full collection run end to end:
 *
 *   createRun → (wipe on /start) → for each symbol: fetch candles, store them,
 *   run analytics + risk, diff-persist signals, persist analytics, populate the
 *   general search table and an AI insight → finishRun.
 *
 * `/start` wipes the ephemeral tables first; `/update` keeps them and relies on
 * the store's diff-aware upserts to touch only what changed. Each dependency is
 * injected, so the pipeline is fully testable with offline doubles.
 */
export class CollectionPipeline {
  constructor(
    private readonly store: LostfastStore,
    private readonly market: MarketDataSource = createMarketSource(),
    private readonly analytics: AnalyticsService = new AnalyticsService(),
    private readonly search: SearchProvider = new KnowledgeBaseSearch(),
    private readonly advisor: AiAdvisor = createAdvisor(),
    private readonly scraper: Scraper | null = createScraper(),
  ) {}

  async collect(kind: RunKind, options: CollectOptions, onProgress?: ProgressListener): Promise<RunReport> {
    const started = Date.now();
    const interval = options.interval ?? '1h';
    const limit = options.limit ?? 200;
    const params = options.params ?? DEFAULT_PARAMETERS;
    const symbols = options.symbols;

    // Work units per symbol: fetch, analyze, persist, search, advise (5), plus an
    // optional scrape when enabled. Add the optional wipe and the final summary.
    const perSymbol = this.scraper ? 6 : 5;
    const totalSteps = symbols.length * perSymbol + (kind === 'start' ? 1 : 0) + 1;
    let step = 0;
    const emit = (e: Omit<ProgressEvent, 'step' | 'totalSteps'>) =>
      onProgress?.({ ...e, step: ++step, totalSteps });

    if (kind === 'start') {
      await this.store.wipeEphemeral();
      emit({ phase: 'wipe', message: 'Cleared previous run data (general search table preserved)' });
    }

    const runId = await this.store.createRun(kind, symbols);
    const reports: SymbolReport[] = [];
    let searchCount = 0;

    for (const symbol of symbols) {
      emit({ phase: 'fetch', symbol, message: `Fetching ${symbol} ${interval} candles` });
      const candles = await this.market.getCandles(symbol, interval, limit);
      const candlesAdded = await this.store.upsertCandles(symbol, interval, candles);

      emit({ phase: 'analyze', symbol, message: `Evaluating ${symbol} across strategies` });
      const analysis = this.analytics.analyze(candles, symbol, params, options.accountBalance);

      emit({ phase: 'persist', symbol, message: `Persisting ${symbol} signals & analytics` });
      let inserted = 0;
      let updated = 0;
      let unchanged = 0;
      for (const { signal, position, status } of analysis.evaluated) {
        const result = await this.store.upsertSignal(runId, {
          symbol: signal.symbol,
          strategy: signal.strategy,
          direction: signal.direction,
          strength: signal.strength,
          reason: signal.reason,
          riskPercent: signal.suggestedRiskPercent,
          status,
          quantity: position?.quantity ?? null,
          notional: position ? position.notional.toNumber() : null,
          at: signal.at,
        });
        if (result === 'inserted') inserted++;
        else if (result === 'updated') updated++;
        else unchanged++;
      }
      await this.store.upsertAnalytics(runId, analysis.analytics);

      emit({ phase: 'search', symbol, message: `Indexing references for ${symbol}` });
      const query = `${symbol} ${analysis.analytics.strongestStrategy ?? 'trading strategy'}`;
      const results = await this.search.search(query, symbol);
      for (const r of results) {
        await this.store.saveSearchResult(r);
      }
      searchCount += results.length;

      let scrapesAdded = 0;
      if (this.scraper) {
        const target = results.find((r) => r.url)?.url;
        emit({ phase: 'scrape', symbol, message: `Scraping reference for ${symbol}` });
        if (target) {
          const scraped = await this.scraper.scrape(target);
          await this.store.saveScrape(runId, { symbol, ...scraped });
          scrapesAdded = 1;
        }
      }

      emit({ phase: 'advise', symbol, message: `Generating AI insight for ${symbol}` });
      const insight = await this.advisor.advise(analysis);
      await this.store.saveInsight(runId, insight);

      reports.push({
        symbol,
        analysis,
        insight: insight.summary,
        candlesAdded,
        signalsInserted: inserted,
        signalsUpdated: updated,
        signalsUnchanged: unchanged,
        scrapesAdded,
      });
    }

    if (this.scraper) await this.scraper.close();
    await this.store.finishRun(runId, 'completed');
    emit({ phase: 'done', message: `Run #${runId} completed for ${symbols.length} symbol(s)` });

    return { runId, kind, symbols: reports, searchResults: searchCount, durationMs: Date.now() - started };
  }
}
