import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { lastDefined, sma } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Pullback: in an established trend (price vs SMA-20), enter on a shallow
 * retracement against the trend, which offers a better risk/reward entry than
 * chasing the extreme.
 */
export const pullback: Strategy = {
  id: 'pullback',
  title: 'Pullback',
  minCandles: 25,

  evaluate(candles, symbol, _params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const price = closes(candles);
    const current = price[price.length - 1];
    const smaValue = lastDefined(sma(price, 20));
    const window = candles.slice(-8);

    if (current > smaValue) {
      const recentHigh = Math.max(...window.map((c) => c.high));
      if (current < recentHigh * 0.985) {
        return makeSignal(this.id, symbol, at, 'long', 0.7, 'Pullback within an uptrend — entry zone');
      }
    } else if (current < smaValue) {
      const recentLow = Math.min(...window.map((c) => c.low));
      if (current > recentLow * 1.015) {
        return makeSignal(this.id, symbol, at, 'short', 0.7, 'Pullback within a downtrend — entry zone');
      }
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.35, 'No clean pullback setup');
  },
};
