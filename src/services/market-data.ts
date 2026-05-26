import type { Candle } from '../domain/candle.js';

export interface MarketDataSource {
  readonly name: string;
  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]>;
}

const COINGECKO_IDS: Record<string, string> = {
  ADA: 'cardano',
  BNB: 'binancecoin',
  BTC: 'bitcoin',
  DOGE: 'dogecoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
};

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
 * Live spot prices from CoinGecko's simple price endpoint. CoinGecko does not
 * return OHLCV bars from this endpoint, so the adapter produces a short,
 * deterministic candle path that lands exactly on the fetched spot rate.
 */
export class CoinGeckoMarketData implements MarketDataSource {
  readonly name = 'coingecko';

  constructor(
    private readonly baseUrl = process.env.LOSTFAST_COINGECKO_API ?? 'https://api.coingecko.com',
    private readonly vsCurrency = 'usd',
  ) {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const id = coinGeckoId(symbol);
    const url = `${this.baseUrl}/api/v3/simple/price?ids=${id}&vs_currencies=${this.vsCurrency}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
    const raw = (await res.json()) as Record<string, Record<string, number>>;
    const price = Number(raw[id]?.[this.vsCurrency]);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`CoinGecko returned no ${this.vsCurrency} price for ${id}`);
    return candlesFromSpot(symbol, interval, limit, price);
  }
}

/** Live spot prices from the public MEXC ticker endpoint. */
export class MexcTickerMarketData implements MarketDataSource {
  readonly name = 'mexc';

  constructor(private readonly baseUrl = process.env.LOSTFAST_MEXC_API ?? 'https://api.mexc.com') {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const url = `${this.baseUrl}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol.toUpperCase())}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`MEXC responded ${res.status}`);
    const raw = (await res.json()) as { price?: string | number; symbol?: string };
    const price = Number(raw.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`MEXC returned no price for ${symbol}`);
    return candlesFromSpot(symbol, interval, limit, price);
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
    // Anchored to a fixed epoch (2024-01-01) — not wall-clock — so the same
    // (symbol, interval, limit) always yields identical candle times. This keeps
    // candle upserts idempotent and the series fully reproducible.
    const start = Date.UTC(2024, 0, 1);
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

function baseAsset(symbol: string): string {
  return symbol.toUpperCase().replace(/(USDT|USDC|USD)$/u, '');
}

function coinGeckoId(symbol: string): string {
  const base = baseAsset(symbol);
  return COINGECKO_IDS[base] ?? base.toLowerCase();
}

function candlesFromSpot(symbol: string, interval: string, limit: number, spot: number): Candle[] {
  const count = Math.max(1, limit);
  const stepMs = intervalMinutes(interval) * 60_000;
  const end = Math.floor(Date.now() / stepMs) * stepMs;
  const seed = [...symbol].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const candles: Candle[] = [];
  const firstOpen = spot * (1 + Math.sin(seed) * 0.01);

  for (let i = 0; i < count; i++) {
    const distance = count - i - 1;
    const wave = Math.sin((seed + i) / 5) * 0.006;
    const drift = distance * 0.0012;
    const close = i === count - 1 ? spot : Math.max(0.01, spot * (1 + drift + wave));
    const open = i === 0 ? firstOpen : candles[i - 1].close;
    const high = Math.max(open, close) * 1.003;
    const low = Math.min(open, close) * 0.997;

    candles.push({
      openTime: end - distance * stepMs,
      open,
      high,
      low,
      close,
      volume: 1_000 + ((seed + i * 17) % 500),
    });
  }

  return candles;
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

/**
 * Selects a market source from `LOSTFAST_MARKET_SOURCE`:
 *   - `synthetic` → deterministic offline data (great for demos/CI/tests),
 *   - `live`/`binance` → Binance only (fails if unreachable),
 *   - `coingecko` → CoinGecko simple price endpoint,
 *   - `mexc`      → MEXC ticker price endpoint,
 *   - `resilient` (default) → live with synthetic fallback.
 */
export function createMarketSource(): MarketDataSource {
  switch ((process.env.LOSTFAST_MARKET_SOURCE ?? 'resilient').toLowerCase()) {
    case 'synthetic':
      return new SyntheticMarketData();
    case 'coingecko':
      return new CoinGeckoMarketData();
    case 'mexc':
      return new MexcTickerMarketData();
    case 'binance':
    case 'live':
      return new BinanceMarketData();
    default:
      return new ResilientMarketData();
  }
}
