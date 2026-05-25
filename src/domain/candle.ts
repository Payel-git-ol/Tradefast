/**
 * A single OHLCV candle. Immutable by convention.
 *
 * Timestamps are stored as epoch milliseconds (UTC) so the domain layer never
 * depends on a particular date library.
 */
export interface Candle {
  readonly openTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

/** Extract the closing prices in chronological order. */
export const closes = (candles: readonly Candle[]): number[] => candles.map((c) => c.close);

/** Extract the high prices in chronological order. */
export const highs = (candles: readonly Candle[]): number[] => candles.map((c) => c.high);

/** Extract the low prices in chronological order. */
export const lows = (candles: readonly Candle[]): number[] => candles.map((c) => c.low);

/** The most recent candle, or `undefined` for an empty series. */
export const lastCandle = (candles: readonly Candle[]): Candle | undefined =>
  candles.length > 0 ? candles[candles.length - 1] : undefined;
