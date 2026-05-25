import type { Candle } from '../domain/candle.js';
import type { StrategyId, StrategyParameters, TradingSignal } from '../domain/signal.js';

/**
 * A trading strategy turns a candle series into a single signal.
 *
 * Strategies are pure and stateless: the same input always yields the same
 * output. This keeps them trivial to unit test and safe to run in parallel.
 */
export interface Strategy {
  readonly id: StrategyId;
  readonly title: string;
  /** Minimum number of candles required to produce a non-neutral signal. */
  readonly minCandles: number;
  evaluate(candles: readonly Candle[], symbol: string, params: StrategyParameters): TradingSignal;
}
