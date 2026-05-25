import type { Strategy } from '../strategy.js';
import { closes, highs, lastCandle, lows } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { makeSignal } from '../helpers.js';

/**
 * Breakout: enter when price closes beyond the highest high / lowest low of the
 * lookback window, having been inside it on the previous bar.
 */
export const breakout: Strategy = {
  id: 'breakout',
  title: 'Breakout',
  minCandles: 30,

  evaluate(candles, symbol, params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const lookback = Math.min(params.lookback, candles.length - 1);
    const h = highs(candles).slice(-lookback - 1, -1);
    const l = lows(candles).slice(-lookback - 1, -1);
    const recentHigh = Math.max(...h);
    const recentLow = Math.min(...l);

    const price = closes(candles);
    const current = price[price.length - 1];
    const previous = price[price.length - 2];

    if (current > recentHigh && previous <= recentHigh) {
      return makeSignal(this.id, symbol, at, 'long', 0.85,
        `Bullish breakout above ${recentHigh.toFixed(2)} (${lookback}-bar high)`);
    }
    if (current < recentLow && previous >= recentLow) {
      return makeSignal(this.id, symbol, at, 'short', 0.85,
        `Bearish breakout below ${recentLow.toFixed(2)} (${lookback}-bar low)`);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.25, 'No breakout detected');
  },
};
