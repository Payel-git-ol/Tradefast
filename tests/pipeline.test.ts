import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb, type DbHandle } from '../src/db/client.js';
import { LostfastStore } from '../src/db/store.js';
import { CollectionPipeline } from '../src/pipeline/collector.js';
import { AnalyticsService } from '../src/services/analytics.js';
import { HeuristicAdvisor } from '../src/services/ai-advisor.js';
import { SyntheticMarketData } from '../src/services/market-data.js';
import { KnowledgeBaseSearch } from '../src/services/search.js';
import type { Scraper, ScrapeResult } from '../src/services/scraping.js';

describe('CollectionPipeline (offline doubles)', () => {
  let handle: DbHandle;
  let store: LostfastStore;
  let pipeline: CollectionPipeline;

  beforeEach(async () => {
    handle = await createDb({ dataDir: ':memory:' });
    store = new LostfastStore(handle.db);
    pipeline = new CollectionPipeline(
      store,
      new SyntheticMarketData(),
      new AnalyticsService(),
      new KnowledgeBaseSearch(),
      new HeuristicAdvisor(),
    );
  });

  afterEach(async () => {
    await handle.close();
  });

  it('runs /start end to end and populates every pillar', async () => {
    const events: string[] = [];
    const report = await pipeline.collect(
      'start',
      { symbols: ['BTCUSDT'], interval: '1h', limit: 120 },
      (e) => events.push(e.phase),
    );

    expect(report.kind).toBe('start');
    expect(report.symbols).toHaveLength(1);
    expect(events[0]).toBe('wipe'); // /start clears first
    expect(events.at(-1)).toBe('done');

    const counts = await store.tableCounts();
    expect(counts.candles).toBeGreaterThan(0);
    expect(counts.signals).toBeGreaterThan(0);
    expect(counts.analytics).toBe(1);
    expect(counts.aiInsights).toBe(1);
    expect(counts.searchResults).toBeGreaterThan(0);
  });

  it('/update only touches changed signals on identical data', async () => {
    await pipeline.collect('start', { symbols: ['ETHUSDT'], interval: '1h', limit: 120 });
    const report = await pipeline.collect('update', { symbols: ['ETHUSDT'], interval: '1h', limit: 120 });

    const sym = report.symbols[0];
    // Deterministic synthetic data → a fresh run id means inserts, never errors,
    // and no candles are added the second time (idempotent upsert).
    expect(sym.candlesAdded).toBe(0);
    expect(sym.signalsInserted + sym.signalsUpdated + sym.signalsUnchanged).toBeGreaterThan(0);
  });

  it('runs the scraping pillar when a scraper is provided', async () => {
    const scraped: string[] = [];
    const fakeScraper: Scraper = {
      name: 'fake',
      async scrape(url: string): Promise<ScrapeResult> {
        scraped.push(url);
        return { url, title: 'Doc', content: 'body', contentHash: `hash:${url}` };
      },
      async close() {},
    };
    const withScraper = new CollectionPipeline(
      store,
      new SyntheticMarketData(),
      new AnalyticsService(),
      new KnowledgeBaseSearch(),
      new HeuristicAdvisor(),
      fakeScraper,
    );

    const report = await withScraper.collect('start', { symbols: ['BTCUSDT'], interval: '1h', limit: 120 });

    expect(scraped.length).toBe(1);
    expect(report.symbols[0].scrapesAdded).toBe(1);
    expect((await store.tableCounts()).scrapes).toBe(1);
  });

  it('/start preserves the general search table across runs', async () => {
    await pipeline.collect('start', { symbols: ['BTCUSDT'], interval: '1h', limit: 120 });
    const before = (await store.tableCounts()).searchResults;
    expect(before).toBeGreaterThan(0);

    await pipeline.collect('start', { symbols: ['BTCUSDT'], interval: '1h', limit: 120 });
    const after = (await store.tableCounts()).searchResults;
    expect(after).toBeGreaterThanOrEqual(before); // never wiped
  });
});
