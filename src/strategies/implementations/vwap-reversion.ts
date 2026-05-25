import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { std } from 'mathjs';
import { vwap } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * VWAP reversion: institutions anchor to the Volume-Weighted Average Price.
 * When price stretches more than ~2 standard deviations of the close-to-VWAP
 * spread away from VWAP, fade the move back toward it.
 */
export const vwapReversion: Strategy = {
  id: 'vwap-reversion',
  title: 'VWAP Reversion',
  minCandles: 30,

  evaluate(candles, symbol, _params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const series = vwap(candles);
    const price = closes(candles);
    const n = price.length - 1;
    const v = series[n];

    const spreads = price.map((p, i) => p - series[i]);
    const sigma = std(spreads, 'uncorrected') as unknown as number;
    if (sigma === 0) return makeSignal(this.id, symbol, at, 'neutral', 0.3, 'No VWAP dispersion');

    const z = (price[n] - v) / sigma;
    if (z <= -2) {
      return makeSignal(this.id, symbol, at, 'long', Math.min(0.85, 0.6 + Math.abs(z) * 0.1),
        `Price ${z.toFixed(2)}σ below VWAP — reversion long`);
    }
    if (z >= 2) {
      return makeSignal(this.id, symbol, at, 'short', Math.min(0.85, 0.6 + Math.abs(z) * 0.1),
        `Price ${z.toFixed(2)}σ above VWAP — reversion short`);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.3, `Price ${z.toFixed(2)}σ from VWAP`);
  },
};
