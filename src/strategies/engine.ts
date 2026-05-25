import type { Candle } from '../domain/candle.js';
import { DEFAULT_PARAMETERS, neutral, type StrategyParameters, type TradingSignal } from '../domain/signal.js';
import type { Strategy } from './strategy.js';
import { ALL_STRATEGIES } from './registry.js';

/**
 * Runs every registered strategy over a candle series and aggregates the
 * results. A failing strategy degrades to a neutral signal rather than taking
 * the whole evaluation down.
 */
export class StrategyEngine {
  constructor(private readonly strategies: readonly Strategy[] = ALL_STRATEGIES) {}

  evaluateAll(
    candles: readonly Candle[],
    symbol: string,
    params: StrategyParameters = DEFAULT_PARAMETERS,
  ): TradingSignal[] {
    const at = candles.length > 0 ? candles[candles.length - 1].openTime : Date.now();
    return this.strategies.map((strategy) => {
      try {
        return strategy.evaluate(candles, symbol, params);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return neutral(strategy.id, symbol, at, `Error: ${message}`);
      }
    });
  }

  /** The highest-confidence signal, or a neutral placeholder if none qualify. */
  strongestSignal(
    candles: readonly Candle[],
    symbol: string,
    params: StrategyParameters = DEFAULT_PARAMETERS,
  ): TradingSignal {
    const signals = this.evaluateAll(candles, symbol, params)
      .filter((s) => s.direction !== 'neutral')
      .sort((a, b) => b.strength - a.strength);
    const at = candles.length > 0 ? candles[candles.length - 1].openTime : Date.now();
    return signals[0] ?? neutral('trend-following', symbol, at, 'No actionable signals');
  }

  /**
   * Net directional consensus across strategies, weighted by strength.
   * Returns a score in [-1, 1]: positive = bullish, negative = bearish.
   */
  consensus(
    candles: readonly Candle[],
    symbol: string,
    params: StrategyParameters = DEFAULT_PARAMETERS,
  ): { score: number; long: number; short: number; neutral: number } {
    const signals = this.evaluateAll(candles, symbol, params);
    let weighted = 0;
    let total = 0;
    let long = 0;
    let short = 0;
    let neutralCount = 0;
    for (const s of signals) {
      if (s.direction === 'long') long++;
      else if (s.direction === 'short') short++;
      else neutralCount++;
      const sign = s.direction === 'long' ? 1 : s.direction === 'short' ? -1 : 0;
      weighted += sign * s.strength;
      total += s.strength;
    }
    const score = total === 0 ? 0 : weighted / total;
    return { score, long, short, neutral: neutralCount };
  }
}
