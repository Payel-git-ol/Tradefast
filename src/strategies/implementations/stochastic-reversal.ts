import type { Strategy } from '../strategy.js';
import { lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { stochastic } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Stochastic reversal: in oversold territory (%K < 20) a %K cross back above %D
 * is a long; in overbought territory (%K > 80) a %K cross below %D is a short.
 */
export const stochasticReversal: Strategy = {
  id: 'stochastic-reversal',
  title: 'Stochastic Reversal',
  minCandles: 25,

  evaluate(candles, symbol, _params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const { k, d } = stochastic(candles, 14, 3);
    const n = candles.length - 1;
    const kNow = k[n];
    const kPrev = k[n - 1];
    const dNow = d[n];
    const dPrev = d[n - 1];
    if ([kNow, kPrev, dNow, dPrev].some(Number.isNaN)) {
      return neutral(this.id, symbol, at, 'Stochastic not ready');
    }

    const crossedUp = kPrev <= dPrev && kNow > dNow;
    const crossedDown = kPrev >= dPrev && kNow < dNow;

    if (kNow < 20 && crossedUp) {
      return makeSignal(this.id, symbol, at, 'long', 0.72, `Oversold stochastic cross up at %K ${kNow.toFixed(1)}`);
    }
    if (kNow > 80 && crossedDown) {
      return makeSignal(this.id, symbol, at, 'short', 0.72, `Overbought stochastic cross down at %K ${kNow.toFixed(1)}`);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.3, `%K ${kNow.toFixed(1)} — no reversal cross`);
  },
};
