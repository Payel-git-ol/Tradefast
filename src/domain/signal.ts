/** Identifiers for every strategy shipped with Lostfast. */
export type StrategyId =
  | 'trend-following'
  | 'mean-reversion'
  | 'breakout'
  | 'scalping-momentum'
  | 'smart-money'
  | 'support-resistance'
  | 'pullback'
  | 'macd-momentum'
  | 'donchian-breakout'
  | 'bollinger-squeeze'
  | 'stochastic-reversal'
  | 'vwap-reversion'
  | 'grid';

/** Directional bias of a signal. */
export type Direction = 'long' | 'short' | 'neutral';

/**
 * The output of a strategy for a given candle series.
 *
 * `strength` is a normalised confidence in the range [0, 1]. `neutral` signals
 * always carry low strength and never reach the risk layer.
 */
export interface TradingSignal {
  readonly strategy: StrategyId;
  readonly symbol: string;
  readonly direction: Direction;
  /** Confidence in the range [0, 1]. */
  readonly strength: number;
  readonly reason: string;
  /** Suggested fraction of equity to risk, as a percentage (e.g. 0.5 = 0.5%). */
  readonly suggestedRiskPercent: number;
  /** Epoch milliseconds the signal was produced for (the last candle's time). */
  readonly at: number;
}

/** Parameters shared by all strategies; individual strategies read what they need. */
export interface StrategyParameters {
  readonly lookback: number;
  /** Minimum strength a signal must reach before the risk layer considers it. */
  readonly threshold: number;
  readonly riskPercent: number;
}

export const DEFAULT_PARAMETERS: StrategyParameters = {
  lookback: 20,
  threshold: 0.5,
  riskPercent: 0.5,
};

export const neutral = (
  strategy: StrategyId,
  symbol: string,
  at: number,
  reason: string,
): TradingSignal => ({
  strategy,
  symbol,
  direction: 'neutral',
  strength: 0,
  reason,
  suggestedRiskPercent: 0,
  at,
});
