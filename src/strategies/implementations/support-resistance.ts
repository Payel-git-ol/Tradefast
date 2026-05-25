import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { makeSignal } from '../helpers.js';

/**
 * Support / Resistance: buy near the recent support floor and sell near the
 * recent resistance ceiling, on the expectation those levels hold.
 */
export const supportResistance: Strategy = {
  id: 'support-resistance',
  title: 'Support & Resistance',
  minCandles: 30,

  evaluate(candles, symbol, _params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const window = candles.slice(-15);
    const support = Math.min(...window.map((c) => c.low));
    const resistance = Math.max(...window.map((c) => c.high));
    const current = closes(candles)[candles.length - 1];

    if (current <= support * 1.001) {
      return makeSignal(this.id, symbol, at, 'long', 0.65, `Price at support zone ~${support.toFixed(2)}`);
    }
    if (current >= resistance * 0.999) {
      return makeSignal(this.id, symbol, at, 'short', 0.65, `Price at resistance zone ~${resistance.toFixed(2)}`);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.3, 'Price between support and resistance');
  },
};
