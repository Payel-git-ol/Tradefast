import type { SymbolAnalysis } from '../services/analytics.js';

/**
 * Reward-to-risk ratio applied to every forecast: the take-profit sits this
 * many times the stop distance away from entry, while the stop is exactly one
 * stop distance away. A 2:1 ratio means a winning trade earns +2R and a losing
 * trade costs −1R.
 */
export const REWARD_RISK_RATIO = 2;

/**
 * The concrete trade Lostfast suggests for a symbol: a direction, an entry, and
 * the two bracket levels (take-profit and stop-loss). `direction` is the empty
 * string when no risk-approved directional signal exists, in which case the
 * bracket levels are null.
 */
export interface Forecast {
  symbol: string;
  direction: 'long' | 'short' | '';
  /** Suggested entry price — the latest close. */
  entry: number | null;
  /** Take-profit target (2R away from entry). */
  tp: number | null;
  /** Stop-loss level (1R away from entry). */
  sl: number | null;
  /** Distance from entry to the stop — the 1R risk unit. */
  stopDistance: number | null;
}

function isFinitePrice(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Derives the trade the system recommends from a symbol analysis.
 *
 * It picks the strongest risk-approved directional signal, anchors the entry at
 * the latest price and brackets it with an ATR-derived stop (one stop distance
 * away) and a {@link REWARD_RISK_RATIO}:1 take-profit. This is the single source
 * of truth shared by the Trade Log table and the backtester, so what users see
 * on screen is exactly what gets validated against history.
 */
export function buildForecast(analysis: SymbolAnalysis): Forecast {
  const entry = analysis.analytics.lastPrice;
  const candidates = analysis.evaluated
    .filter((item) => item.position && (item.signal.direction === 'long' || item.signal.direction === 'short'))
    .sort((a, b) => {
      const approvedDelta = Number(b.risk?.approved === true) - Number(a.risk?.approved === true);
      return approvedDelta !== 0 ? approvedDelta : b.signal.strength - a.signal.strength;
    });

  const selected = candidates[0];
  const direction =
    selected?.signal.direction === 'long' || selected?.signal.direction === 'short' ? selected.signal.direction : '';
  const stopDistance = selected?.position?.stopDistance;

  if (!isFinitePrice(entry) || !isFinitePrice(stopDistance)) {
    return {
      symbol: analysis.symbol,
      direction,
      tp: null,
      sl: null,
      entry: isFinitePrice(entry) ? entry : null,
      stopDistance: null,
    };
  }

  if (direction === 'short') {
    return {
      symbol: analysis.symbol,
      direction,
      tp: entry - stopDistance * REWARD_RISK_RATIO,
      sl: entry + stopDistance,
      entry,
      stopDistance,
    };
  }

  return {
    symbol: analysis.symbol,
    direction,
    tp: entry + stopDistance * REWARD_RISK_RATIO,
    sl: entry - stopDistance,
    entry,
    stopDistance,
  };
}
