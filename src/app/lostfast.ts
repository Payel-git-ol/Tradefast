import { createDb, type DbHandle } from '../db/client.js';
import { LostfastStore } from '../db/store.js';
import type { AnalyticsRow } from '../db/store.js';
import { loadConfig, type LostfastConfig } from '../config.js';
import { CollectionPipeline, type ProgressListener, type RunReport } from '../pipeline/collector.js';
import { ALL_STRATEGIES } from '../strategies/registry.js';

export interface StatusReport {
  driver: string;
  counts: Record<string, number>;
  latestRunId?: number;
  latestAnalytics: AnalyticsRow[];
}

/**
 * The application facade. It owns the database handle, the store and the
 * collection pipeline, and exposes exactly the three operations the CLI needs —
 * `/start`, `/update` and `/clear` — plus read-only status. Keeping this logic
 * out of the UI means the same behaviour backs both the interactive shell and
 * the non-interactive subcommands.
 */
export class Lostfast {
  private constructor(
    private readonly handle: DbHandle,
    private readonly store: LostfastStore,
    private readonly pipeline: CollectionPipeline,
    readonly config: LostfastConfig,
  ) {}

  static async create(config: LostfastConfig = loadConfig()): Promise<Lostfast> {
    const handle = await createDb();
    const store = new LostfastStore(handle.db);
    const pipeline = new CollectionPipeline(store);
    return new Lostfast(handle, store, pipeline, config);
  }

  get driver(): string {
    return this.handle.driver;
  }

  /** `/start` — clear prior run data (keeping the search table) and analyse afresh. */
  start(onProgress?: ProgressListener): Promise<RunReport> {
    return this.pipeline.collect(
      'start',
      {
        symbols: this.config.symbols,
        interval: this.config.interval,
        limit: this.config.candleLimit,
        accountBalance: this.config.accountBalance,
      },
      onProgress,
    );
  }

  /** `/update` — re-analyse, writing only rows that actually changed. */
  update(onProgress?: ProgressListener): Promise<RunReport> {
    return this.pipeline.collect(
      'update',
      {
        symbols: this.config.symbols,
        interval: this.config.interval,
        limit: this.config.candleLimit,
        accountBalance: this.config.accountBalance,
      },
      onProgress,
    );
  }

  /** `/clear` — prune outdated runs; the general search table is preserved. */
  clear(): Promise<number> {
    return this.store.pruneOutdated();
  }

  async status(): Promise<StatusReport> {
    const counts = await this.store.tableCounts();
    const latestRunId = await this.store.latestRunId();
    const latestAnalytics = latestRunId ? await this.store.latestAnalytics(latestRunId) : [];
    return { driver: this.driver, counts, latestRunId, latestAnalytics };
  }

  strategies(): { id: string; title: string }[] {
    return ALL_STRATEGIES.map((s) => ({ id: s.id, title: s.title }));
  }

  close(): Promise<void> {
    return this.handle.close();
  }
}
