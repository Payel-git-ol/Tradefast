import type { Direction, StrategyId, TradingSignal } from '../domain/signal.js';

/** Clamp a value into the [0, 1] confidence range. */
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Build a directional signal with a clamped strength. */
export function makeSignal(
  strategy: StrategyId,
  symbol: string,
  at: number,
  direction: Direction,
  strength: number,
  reason: string,
  suggestedRiskPercent = 0.5,
): TradingSignal {
  return {
    strategy,
    symbol,
    direction,
    strength: clamp01(strength),
    reason,
    suggestedRiskPercent: direction === 'neutral' ? 0 : suggestedRiskPercent,
    at,
  };
}
