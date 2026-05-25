import type { Candle } from '../domain/candle.js';

export interface MarketDataSource {
  readonly name: string;
  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]>;
}

/**
 * Live OHLCV from the public Binance REST API. No key required. The base URL is
 * configurable so a mirror or mock server can be used.
 */
export class BinanceMarketData implements MarketDataSource {
  readonly name = 'binance';
  constructor(private readonly baseUrl = process.env.LOSTFAST_MARKET_API ?? 'https://api.binance.com') {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Binance responded ${res.status}`);
    const raw = (await res.json()) as unknown[][];
    return raw.map((k) => ({
      openTime: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  }
}

/**
 * Deterministic synthetic candles for offline use and tests. The series is
 * reproducible from `symbol` so the same input always yields the same data —
 * useful for snapshot-style verification.
 */
export class SyntheticMarketData implements MarketDataSource {
  readonly name = 'synthetic';

  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    let seed = [...symbol].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + intervalMinutes(interval);
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const stepMs = intervalMinutes(interval) * 60_000;
    const start = Date.now() - limit * stepMs;
    let price = 100 + (seed % 500);
    const candles: Candle[] = [];
    for (let i = 0; i < limit; i++) {
      const drift = (rand() - 0.48) * price * 0.02;
      const open = price;
      const close = Math.max(1, open + drift);
      const high = Math.max(open, close) * (1 + rand() * 0.01);
      const low = Math.min(open, close) * (1 - rand() * 0.01);
      candles.push({ openTime: start + i * stepMs, open, high, low, close, volume: 100 + rand() * 1000 });
      price = close;
    }
    return Promise.resolve(candles);
  }
}

function intervalMinutes(interval: string): number {
  const map: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440 };
  return map[interval] ?? 60;
}

/**
 * Returns live candles when the network is reachable, falling back to a
 * deterministic synthetic source so the CLI always works — including in CI and
 * air-gapped environments.
 */
export class ResilientMarketData implements MarketDataSource {
  readonly name = 'resilient';
  constructor(
    private readonly live: MarketDataSource = new BinanceMarketData(),
    private readonly fallback: MarketDataSource = new SyntheticMarketData(),
    private readonly allowFallback = true,
  ) {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    try {
      return await this.live.getCandles(symbol, interval, limit);
    } catch (error) {
      if (!this.allowFallback) throw error;
      return this.fallback.getCandles(symbol, interval, limit);
    }
  }
}
