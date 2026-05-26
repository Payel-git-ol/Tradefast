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

  it('uses MEXC real klines and returns proper OHLCV (last close = live price in mock)', async () => {
    // Realistic klines response: [openTime, open, high, low, close, volume, ...]
    const mockKlines = Array.from({ length: 20 }, (_, i) => [
      1710000000000 + i * 3600_000,
      '68000',
      '68100',
      '67950',
      String(68000 + i * 10), // last one will be ~68190
      '123.45',
    ]);
    const fetchMock = vi.fn(async () => Response.json(mockKlines));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const candles = await new MexcTickerMarketData('https://api.example.test').getCandles('BTCUSDT', '1h', 20);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=20',
      expect.any(Object),
    );
    expect(candles).toHaveLength(20);
    expect(candles.at(-1)?.close).toBe(68190);
  });

  it('selects CoinGecko and MEXC sources from configuration', () => {
    vi.stubEnv('LOSTFAST_MARKET_SOURCE', 'coingecko');
    expect(createMarketSource()).toBeInstanceOf(CoinGeckoMarketData);

    vi.stubEnv('LOSTFAST_MARKET_SOURCE', 'mexc');
    expect(createMarketSource()).toBeInstanceOf(MexcTickerMarketData);
  });
});
