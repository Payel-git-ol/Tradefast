import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb, type DbHandle } from '../src/db/client.js';
import { LostfastStore } from '../src/db/store.js';
import type { Candle } from '../src/domain/candle.js';

const candle = (t: number, close: number): Candle => ({
  openTime: t,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 100,
});

describe('LostfastStore (PGlite in-memory)', () => {
  let handle: DbHandle;
  let store: LostfastStore;

  beforeEach(async () => {
    handle = await createDb({ dataDir: ':memory:' });
    store = new LostfastStore(handle.db);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('applies migrations and starts empty', async () => {
    const counts = await store.tableCounts();
    expect(counts.searchResults).toBe(0);
    expect(counts.signals).toBe(0);
  });

  it('inserts candles idempotently', async () => {
    const inserted1 = await store.upsertCandles('BTCUSDT', '1h', [candle(1000, 50), candle(2000, 51)]);
    expect(inserted1).toBe(2);
    // Re-inserting the same candles changes nothing.
    const inserted2 = await store.upsertCandles('BTCUSDT', '1h', [candle(1000, 50), candle(2000, 51)]);
    expect(inserted2).toBe(0);
    const candles = await store.getCandles('BTCUSDT', '1h');
    expect(candles).toHaveLength(2);
    expect(candles[0].close).toBe(50);
  });

  it('update-aware signal upsert reports change status', async () => {
    const runId = await store.createRun('start', ['BTCUSDT']);
    const row = {
      symbol: 'BTCUSDT',
      strategy: 'trend-following',
      direction: 'long',
      strength: 0.8,
      reason: 'r',
      riskPercent: 0.5,
      status: 'evaluated',
      at: 1000,
    };
    expect(await store.upsertSignal(runId, row)).toBe('inserted');
    expect(await store.upsertSignal(runId, row)).toBe('unchanged');
    expect(await store.upsertSignal(runId, { ...row, strength: 0.9 })).toBe('updated');
  });

  it('/start wipe preserves the general search_results table', async () => {
    await store.saveSearchResult({ query: 'btc', source: 'test', title: 'hello' });
    const runId = await store.createRun('start', ['BTCUSDT']);
    await store.upsertCandles('BTCUSDT', '1h', [candle(1000, 50)]);
    await store.upsertSignal(runId, {
      symbol: 'BTCUSDT', strategy: 'breakout', direction: 'long', strength: 0.8,
      reason: 'r', riskPercent: 0.5, status: 'evaluated', at: 1000,
    });

    await store.wipeEphemeral();

    const counts = await store.tableCounts();
    expect(counts.signals).toBe(0);
    expect(counts.candles).toBe(0);
    expect(counts.runs).toBe(0);
    expect(counts.searchResults).toBe(1); // preserved
  });

  it('/clear prunes outdated runs but keeps the latest and the general table', async () => {
    await store.saveSearchResult({ query: 'btc', source: 'test', title: 'keep me' });
    const r1 = await store.createRun('start', ['BTCUSDT']);
    await store.upsertSignal(r1, {
      symbol: 'BTCUSDT', strategy: 'breakout', direction: 'long', strength: 0.8,
      reason: 'r', riskPercent: 0.5, status: 'evaluated', at: 1,
    });
    const r2 = await store.createRun('update', ['BTCUSDT']);
    await store.upsertSignal(r2, {
      symbol: 'BTCUSDT', strategy: 'breakout', direction: 'long', strength: 0.8,
      reason: 'r', riskPercent: 0.5, status: 'evaluated', at: 2,
    });

    const pruned = await store.pruneOutdated();
    expect(pruned).toBe(1);

    const counts = await store.tableCounts();
    expect(counts.runs).toBe(1); // only the latest run remains
    expect(counts.signals).toBe(1); // r1's signal cascaded away
    expect(counts.searchResults).toBe(1); // preserved
  });
});
