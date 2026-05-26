import { describe, expect, it } from 'vitest';

import { LostfastResolver, type LostfastApiFacade } from '../src/backend/graphql.js';
import { startLostfastBackend } from '../src/backend/server.js';

const facade: LostfastApiFacade = {
  driver: 'pglite',
  strategies: () => [{ id: 'trend-following', title: 'Trend Following' }],
  status: async () => ({
    driver: 'pglite',
    counts: { runs: 1, candles: 20 },
    latestRunId: 1,
    latestAnalytics: [
      {
        symbol: 'BTCUSDT',
        consensusScore: 0.42,
        longCount: 4,
        shortCount: 1,
        neutralCount: 8,
        strongestStrategy: 'trend-following',
        strongestStrength: 0.7,
        lastPrice: 60_000,
        atr: 120,
      },
    ],
  }),
  start: async () => ({
    runId: 2,
    kind: 'start',
    symbols: [],
    searchResults: 0,
    durationMs: 1,
  }),
  update: async () => ({
    runId: 3,
    kind: 'update',
    symbols: [],
    searchResults: 0,
    durationMs: 1,
  }),
  clear: async () => 1,
};

describe('Nest GraphQL resolver', () => {
  it('maps Lostfast status and strategies into GraphQL DTOs', async () => {
    const resolver = new LostfastResolver(facade);

    await expect(resolver.strategies()).resolves.toEqual([{ id: 'trend-following', title: 'Trend Following' }]);
    await expect(resolver.status()).resolves.toMatchObject({
      driver: 'pglite',
      latestRunId: 1,
      counts: [
        { name: 'runs', count: 1 },
        { name: 'candles', count: 20 },
      ],
      latestAnalytics: [{ symbol: 'BTCUSDT', lastPrice: 60_000 }],
    });
  });

  it('exposes start, update, and clear mutations', async () => {
    const resolver = new LostfastResolver(facade);

    await expect(resolver.start()).resolves.toMatchObject({ runId: 2, kind: 'start' });
    await expect(resolver.update()).resolves.toMatchObject({ runId: 3, kind: 'update' });
    await expect(resolver.clear()).resolves.toBe(1);
  });

  it('serves the GraphQL schema over HTTP', async () => {
    const backend = await startLostfastBackend(facade);

    try {
      const response = await fetch(backend.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ status { driver counts { name count } } }' }),
      });
      const json = (await response.json()) as { data?: { status?: { driver?: string } } };

      expect(response.ok).toBe(true);
      expect(json.data?.status?.driver).toBe('pglite');
    } finally {
      await backend.close();
    }
  });
});
