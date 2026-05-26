import { afterEach, describe, expect, it, vi } from 'vitest';

import { CoinGeckoMarketData, createMarketSource, MexcTickerMarketData } from '../src/services/market-data.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe('spot-price market data sources', () => {
  it('uses CoinGecko simple price data and ends candles at the live rate', async () => {
    const fetchMock = vi.fn(async () => Response.json({ bitcoin: { usd: 60_000 } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const candles = await new CoinGeckoMarketData('https://api.example.test').getCandles('BTCUSDT', '1h', 20);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      expect.any(Object),
    );
    expect(candles).toHaveLength(20);
    expect(candles.at(-1)?.close).toBe(60_000);
  });

  it('uses MEXC ticker prices and ends candles at the live rate', async () => {
    const fetchMock = vi.fn(async () => Response.json({ symbol: 'BTCUSDT', price: '76969.71' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const candles = await new MexcTickerMarketData('https://api.example.test').getCandles('BTCUSDT', '1h', 20);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v3/ticker/price?symbol=BTCUSDT',
      expect.any(Object),
    );
    expect(candles.at(-1)?.close).toBe(76969.71);
  });

  it('selects CoinGecko and MEXC sources from configuration', () => {
    vi.stubEnv('LOSTFAST_MARKET_SOURCE', 'coingecko');
    expect(createMarketSource()).toBeInstanceOf(CoinGeckoMarketData);

    vi.stubEnv('LOSTFAST_MARKET_SOURCE', 'mexc');
    expect(createMarketSource()).toBeInstanceOf(MexcTickerMarketData);
  });
});
