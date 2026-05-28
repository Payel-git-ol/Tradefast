import { createDb, type DbHandle } from '../db/client.js';
import { LostfastStore } from '../db/store.js';
import type { AnalyticsRow } from '../db/store.js';
import { loadConfig, type LostfastConfig } from '../config.js';
import type { Candle } from '../domain/candle.js';
import { CollectionPipeline, type CollectOptions, type ProgressListener, type RunReport } from '../pipeline/collector.js';
import {
  aggregateBacktests,
  backtestSymbol,
  type BacktestReport,
  type BacktestResult,
} from '../services/backtest.js';
import { createResilientMarketSourceFor, type MarketDataSource } from '../services/market-data.js';
import {
  createNewsCrawler,
  type NewsCrawler,
  type NewsCrawlReport,
  type NewsProgressListener,
} from '../services/news-crawler.js';
import { ALL_STRATEGIES } from '../strategies/registry.js';
import { computeCrowdConsensus, type InstrumentConsensus } from '../services/news-consensus.js';

export interface StatusReport {
  driver: string;
  counts: Record<string, number>;
  latestRunId?: number;
  latestAnalytics: AnalyticsRow[];
  crowdConsensus?: import('../services/news-consensus.js').InstrumentConsensus[];
}

export interface CurrencyForecast {
  symbol: string;
  report: RunReport;
  price: number | null;
  newsConsensus: InstrumentConsensus[];
  candles: Candle[];
}

export interface PersistedNewsCrawlReport extends NewsCrawlReport {
  inserted: number;
  updated: number;
  unchanged: number;
}

/** Options accepted by {@link Lostfast.backtest}. */
export interface BacktestRunOptions {
  /** Bars of warm-up history before the first forecast. */
  warmup?: number;
  /** Maximum bars to hold a trade before closing at market. */
  horizon?: number;
}

/** Streamed per-symbol progress for the backtest command. */
export type BacktestProgressListener = (event: { message: string; step: number; totalSteps: number }) => void;

/**
 * The application facade. It owns the database handle, the store and the
 * collection pipeline, and exposes the lifecycle/news operations the CLI needs
 * plus read-only status. Keeping this logic out of the UI means the same
 * behaviour backs both the interactive shell and the non-interactive subcommands.
 */
export class Lostfast {
  private constructor(
    private readonly handle: DbHandle,
    private readonly store: LostfastStore,
    private pipeline: CollectionPipeline,
    private readonly newsCrawler: NewsCrawler,
    readonly config: LostfastConfig,
    private market: MarketDataSource,
  ) {}

  static async create(config: LostfastConfig = loadConfig()): Promise<Lostfast> {
    const handle = await createDb();
    const store = new LostfastStore(handle.db);
    const market = createResilientMarketSourceFor(config.exchange);
    const pipeline = new CollectionPipeline(store, market);
    const newsCrawler = await createNewsCrawler();
    return new Lostfast(handle, store, pipeline, newsCrawler, config, market);
  }

  /** Updates the exchange used for market data on subsequent /start and /update.
   *  Called by the interactive CLI when the user runs /exchange at runtime.
   */
  setExchange(name: string): void {
    (this.config as any).exchange = name;
    this.market = createResilientMarketSourceFor(name);
    this.pipeline = new CollectionPipeline(this.store, this.market);
  }

  setInterval(interval: string): void {
    (this.config as any).interval = interval;
  }

  /** Records the active operating mode (trading style). The associated timeframe
   *  is applied separately via {@link setInterval} so analysis actually shifts
   *  to the chosen horizon. */
  setMode(mode: string): void {
    (this.config as any).mode = mode;
  }

  get driver(): string {
    return this.handle.driver;
  }

  /** `/start` — clear prior run data (keeping the search table) and analyse afresh. */
  async start(onProgress?: ProgressListener, extra?: Partial<CollectOptions>): Promise<RunReport> {
    await this.clearNewsConsensus(); // fresh big crowd table on every full start
    return this.pipeline.collect(
      'start',
      {
        symbols: this.config.symbols,
        interval: this.config.interval,
        limit: this.config.candleLimit,
        accountBalance: this.config.accountBalance,
        ...extra,
      },
      onProgress,
    );
  }

  /** `/update` — re-analyse, writing only rows that actually changed. */
  update(onProgress?: ProgressListener, extra?: Partial<CollectOptions>): Promise<RunReport> {
    return this.pipeline.collect(
      'update',
      {
        symbols: this.config.symbols,
        interval: this.config.interval,
        limit: this.config.candleLimit,
        accountBalance: this.config.accountBalance,
        ...extra,
      },
      onProgress,
    );
  }

  /**
   * `/backtest` — replay history and report how often each forecast's
   * take-profit was reached before its stop-loss. Uses the same forecast logic
   * the Trade Log shows, so the metrics describe the live system, not a
   * different model.
   */
  async backtest(
    onProgress?: BacktestProgressListener,
    options: BacktestRunOptions = {},
  ): Promise<BacktestReport> {
    const interval = this.config.interval;
    const limit = this.config.candleLimit;
    const symbols = this.config.symbols;
    const results: BacktestResult[] = [];

    let step = 0;
    for (const symbol of symbols) {
      onProgress?.({ message: `Backtesting ${symbol} on ${interval}`, step: ++step, totalSteps: symbols.length });
      const candles = await this.market.getCandles(symbol, interval, limit);
      results.push(
        backtestSymbol(candles, symbol, {
          warmup: options.warmup,
          horizon: options.horizon,
          accountBalance: this.config.accountBalance,
        }),
      );
    }

    return aggregateBacktests(results);
  }

  /** `/currency` — run a full forecast for a single symbol, including news consensus. */
  async forecastCurrency(symbol: string, onProgress?: ProgressListener, extra?: Partial<CollectOptions>): Promise<CurrencyForecast> {
    const report = await this.pipeline.collect(
      'update',
      {
        symbols: [symbol],
        interval: this.config.interval,
        limit: this.config.candleLimit,
        accountBalance: this.config.accountBalance,
        ...extra,
      },
      onProgress,
    );

    const lastAnalysis = report.symbols[0]?.analysis.analytics;
    const price = lastAnalysis?.lastPrice ?? null;

    const baseAsset = symbol.replace(/USDT$/, '').replace(/USD$/, '').replace(/BTC$/, '').replace(/ETH$/, '');
    const allConsensus = await this.store.getNewsConsensus(200);
    const currencyNews = allConsensus.filter(
      (c) =>
        c.instrument.toUpperCase() === baseAsset.toUpperCase() ||
        c.instrument.toUpperCase() === symbol.toUpperCase(),
    );

    const candles = await this.store.getCandles(symbol, this.config.interval);

    return { symbol, report, price, newsConsensus: currencyNews, candles };
  }

  /** Read back persisted candles for chart rendering. */
  getCandles(symbol: string, interval: string): Promise<Candle[]> {
    return this.store.getCandles(symbol, interval);
  }

  /** `/clear` — prune outdated runs; the general search table is preserved. */
  clear(): Promise<number> {
    return this.store.pruneOutdated();
  }

  async news(onProgress?: NewsProgressListener, crawlOptions?: Partial<import('../services/news-crawler.js').NewsCrawlOptions>): Promise<PersistedNewsCrawlReport> {
    const crawlReport = await this.newsCrawler.crawl(onProgress, crawlOptions);
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    for (const item of crawlReport.items) {
      const result = await this.store.saveNewsItem(item);
      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
      else unchanged++;
    }
    // Rebuild the big crowd table from the fresh news (includes forex, macro, everything)
    await this.rebuildNewsConsensus();
    return { ...crawlReport, inserted, updated, unchanged };
  }

  async status(): Promise<StatusReport> {
    const counts = await this.store.tableCounts();
    const latestRunId = await this.store.latestRunId();
    const latestAnalytics = latestRunId ? await this.store.latestAnalytics(latestRunId) : [];
    const crowd = await this.store.getNewsConsensus(60); // big table — top 60 by interest
    return { driver: this.driver, counts, latestRunId, latestAnalytics, crowdConsensus: crowd };
  }

  strategies(): { id: string; title: string }[] {
    return ALL_STRATEGIES.map((s) => ({ id: s.id, title: s.title }));
  }

  /** Rebuilds the big news-driven crowd consensus table (the large one with forex + macro + everything the crawler found). */
  async rebuildNewsConsensus(): Promise<number> {
    const items = await this.store.getRecentNewsItems(5000);
    const consensus = computeCrowdConsensus(items);
    await this.store.replaceNewsConsensus(consensus);
    return consensus.length;
  }

  async getNewsCrowdConsensus(limit?: number) {
    return this.store.getNewsConsensus(limit);
  }

  async clearNewsConsensus(): Promise<number> {
    return this.store.clearNewsConsensus();
  }

  close(): Promise<void> {
    return this.handle.close();
  }
}
