import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { makeSignal } from '../helpers.js';

/**
 * Smart Money Concept (simplified): detect a Break of Structure (BOS) where
 * price decisively closes beyond the most recent swing high/low, signalling a
 * shift in order flow.
 */
export const smartMoney: Strategy = {
  id: 'smart-money',
  title: 'Smart Money Concept (BOS)',
  minCandles: 30,

  evaluate(candles, symbol, _params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const swing = candles.slice(-11, -1); // 10 bars before the current one
    const recentHigh = Math.max(...swing.map((c) => c.high));
    const recentLow = Math.min(...swing.map((c) => c.low));

    const price = closes(candles);
    const current = price[price.length - 1];
    const previous = price[price.length - 2];

    if (current > recentHigh && previous <= recentHigh) {
      return makeSignal(this.id, symbol, at, 'long', 0.75, 'Bullish break of structure (BOS) detected');
    }
    if (current < recentLow && previous >= recentLow) {
      return makeSignal(this.id, symbol, at, 'short', 0.75, 'Bearish break of structure (BOS) detected');
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.3, 'No clear market-structure break');
  },
};
