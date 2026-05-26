import type { Candle } from '../domain/candle.js';
import type { ExchangeName } from '../cli/exchanges.js';
import { logMarketData } from './logger.js';

export interface MarketDataSource {
  readonly name: string;
  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]>;
}

/**
 * Диапазоны цен для валидации: [floor, ceiling].
 * Синтетический генератор выдаёт 100–600, поэтому ceiling ловит фейки
 * для дешёвых монет (XRP, ADA, DOT и т.д.), а floor — для дорогих (BTC, ETH).
 */
const PRICE_RANGES: Record<string, [number, number]> = {
  BTC:  [10_000, 200_000],
  ETH:  [500,    15_000],
  BNB:  [100,    2_000],
  SOL:  [1,      300],
  XRP:  [0.05,   10],
  ADA:  [0.02,   5],
  DOGE: [0.001,  1],
  AVAX: [1,      200],
  DOT:  [0.05,   10],
  LINK: [0.5,    100],
  LTC:  [1,      500],
  NEAR: [0.05,   50],
  APT:  [0.05,   50],
  ARB:  [0.01,   10],
  SUI:  [0.01,   50],
  TON:  [0.01,   50],
  PEPE: [1e-12,  0.01],
};

function priceRange(symbol: string): [number, number] {
  return PRICE_RANGES[baseAsset(symbol)] ?? [0.001, 1_000_000];
}

function validateCandles(candles: Candle[], symbol: string): void {
  if (candles.length === 0) return;
  const [floor, ceiling] = priceRange(symbol);
  const last = candles[candles.length - 1];
  if (last.close < floor) {
    throw new Error(
      `Price too low for ${symbol}: close=${last.close} < floor ${floor}. ` +
      `Check LOSTFAST_EXCHANGE or use LOSTFAST_MARKET_SOURCE=synthetic for demo mode.`,
    );
  }
  if (last.close > ceiling) {
    throw new Error(
      `Price too high for ${symbol}: close=${last.close} > ceiling ${ceiling}. ` +
      `Check LOSTFAST_EXCHANGE or use LOSTFAST_MARKET_SOURCE=synthetic for demo mode.`,
    );
  }
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

/** Real OHLCV klines from MEXC spot public API (Binance-compatible /klines). */
export class MexcMarketData implements MarketDataSource {
  readonly name = 'mexc';

  constructor(private readonly baseUrl = process.env.LOSTFAST_MEXC_API ?? 'https://api.mexc.com') {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const iv = toMexcInterval(interval);
    const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${iv}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`MEXC responded ${res.status}`);
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

/** Real spot OHLCV klines from Bybit v5 public endpoint. */
export class BybitMarketData implements MarketDataSource {
  readonly name = 'bybit';

  constructor(private readonly baseUrl = process.env.LOSTFAST_BYBIT_API ?? 'https://api.bybit.com') {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const iv = toBybitInterval(interval);
    const url = `${this.baseUrl}/v5/market/kline?category=spot&symbol=${symbol.toUpperCase()}&interval=${iv}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Bybit responded ${res.status}`);
    const json = (await res.json()) as { retCode?: number; result?: { list?: unknown[][] } };
    if (json.retCode && json.retCode !== 0) throw new Error(`Bybit error ${json.retCode}`);
    const list = json.result?.list ?? [];
    // Bybit returns newest-first → reverse for consistent oldest-first order
    return [...list]
      .reverse()
      .map((k) => ({
        openTime: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }));
  }
}

/** Real spot OHLCV candles from OKX v5 public endpoint. */
export class OkxMarketData implements MarketDataSource {
  readonly name = 'okx';

  constructor(private readonly baseUrl = process.env.LOSTFAST_OKX_API ?? 'https://www.okx.com') {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const instId = toOkxInstId(symbol);
    const bar = toOkxBar(interval);
    const url = `${this.baseUrl}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`OKX responded ${res.status}`);
    const json = (await res.json()) as { code?: string; data?: unknown[][] };
    if (json.code && json.code !== '0') throw new Error(`OKX error ${json.code}`);
    const data = json.data ?? [];
    // OKX returns newest-first → reverse
    return [...data]
      .reverse()
      .map((k) => ({
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
 *
 * ⚠️  WARNING: This source generates prices between 100–600 and is NOT suitable
 * for real trading decisions. It exists for demos, CI, and offline testing.
 */
export class SyntheticMarketData implements MarketDataSource {
  readonly name = 'synthetic';

  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    console.warn(`[SYNTHETIC] Generating fake candles for ${symbol}. ` +
      `These prices are NOT real market data. Set LOSTFAST_MARKET_SOURCE=resilient and LOSTFAST_EXCHANGE=<exchange>.`);
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

function toMexcInterval(interval: string): string {
  // MEXC uses same strings as Binance for most common intervals
  const map: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
  return map[interval] ?? '1h';
}

function toBybitInterval(interval: string): string {
  // Bybit v5: 1,3,5,15,30,60,120,240,360,720,D,W,M
  const map: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' };
  return map[interval] ?? '60';
}

function toOkxBar(interval: string): string {
  // OKX: 1m,5m,15m,30m,1H,4H,1D,1W,1M
  const map: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };
  return map[interval] ?? '1H';
}

function toOkxInstId(symbol: string): string {
  // OKX uses hyphenated pairs, e.g. BTC-USDT
  return symbol.toUpperCase().replace(/(USDT|USDC|USD)$/, '-$1').replace(/--/g, '-');
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
 * Wraps a live MarketDataSource with price validation and file logging.
 * Every successful fetch and every error is recorded to logs/market-data.log.
 *
 * IMPORTANT: This class does NOT fall back to synthetic data. If the live
 * source fails (network error, rate limit, bad response) the error is logged
 * and rethrown so the user sees exactly what went wrong. Use
 * `LOSTFAST_MARKET_SOURCE=synthetic` explicitly for demo/offline mode.
 */
export class ResilientMarketData implements MarketDataSource {
  readonly name = 'resilient';
  constructor(private readonly live: MarketDataSource) {}

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    try {
      const candles = await this.live.getCandles(symbol, interval, limit);
      validateCandles(candles, symbol);
      logMarketData(symbol, this.live.name, 'ok', `${candles.length} candles`, candles.length);
      return candles;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logMarketData(symbol, this.live.name, 'error', msg);
      throw error;
    }
  }
}

/** @deprecated Use MexcMarketData (real klines). Temporary alias for backward compat. */
export { MexcMarketData as MexcTickerMarketData };

/**
 * Selects a market source from `LOSTFAST_MARKET_SOURCE`:
 *   - `synthetic` → deterministic offline data (great for demos/CI/tests),
 *   - `live`/`binance` → Binance only (fails if unreachable),
 *   - `coingecko` → CoinGecko simple price endpoint,
 *   - `mexc`      → MEXC real klines,
 *   - `resilient` (default) → live with synthetic fallback.
 */
export function createMarketSource(): MarketDataSource {
  switch ((process.env.LOSTFAST_MARKET_SOURCE ?? 'resilient').toLowerCase()) {
    case 'synthetic':
      return new SyntheticMarketData();
    case 'coingecko':
      return new CoinGeckoMarketData();
    case 'mexc':
      return new MexcMarketData();
    case 'binance':
    case 'live':
      return new BinanceMarketData();
    default:
      return new ResilientMarketData(new BinanceMarketData());
  }
}

/**
 * Wraps any MarketDataSource with price validation.
 * Throws if candle prices fall below realistic floors for the symbol.
 */
export function withPriceValidation(source: MarketDataSource): MarketDataSource {
  const origGetCandles = source.getCandles.bind(source);
  return {
    name: source.name,
    getCandles: async (symbol, interval, limit) => {
      const candles = await origGetCandles(symbol, interval, limit);
      validateCandles(candles, symbol);
      return candles;
    },
  };
}

/**
 * Creates a live market data source for the given exchange (Binance, Bybit, OKX, MEXC).
 * Falls back to Binance if unknown. This is the preferred way when the user has
 * selected an exchange via /exchange or LOSTFAST_EXCHANGE.
 *
 * Prices are validated against realistic floors after every fetch.
 */
export function createMarketSourceFor(exchange?: ExchangeName | string): MarketDataSource {
  const ex = (exchange ?? 'binance').toLowerCase();
  const inner = (() => {
    switch (ex) {
      case 'bybit':
        return new BybitMarketData();
      case 'okx':
        return new OkxMarketData();
      case 'mexc':
        return new MexcMarketData();
      case 'binance':
      default:
        return new BinanceMarketData();
    }
  })();
  // Decorate with price validation
  return {
    name: inner.name,
    getCandles: async (symbol, interval, limit) => {
      const candles = await inner.getCandles(symbol, interval, limit);
      validateCandles(candles, symbol);
      return candles;
    },
  };
}

/**
 * Creates a MarketDataSource for the chosen exchange, wrapped with price
 * validation and file logging (logs/market-data.log). No synthetic fallback:
 * all errors propagate directly to the user.
 */
export function createResilientMarketSourceFor(exchange?: ExchangeName | string): MarketDataSource {
  return new ResilientMarketData(createMarketSourceFor(exchange));
}
