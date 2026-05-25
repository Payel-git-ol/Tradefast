import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { bollingerBands } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Bollinger squeeze: low volatility (a narrow band relative to its own recent
 * range) tends to precede an expansion. When the band width is in the lowest
 * part of its range and price pushes through a band, trade the breakout in that
 * direction.
 */
export const bollingerSqueeze: Strategy = {
  id: 'bollinger-squeeze',
  title: 'Bollinger Squeeze',
  minCandles: 40,

  evaluate(candles, symbol, params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const price = closes(candles);
    const { upper, middle, lower } = bollingerBands(price, params.lookback, 2);
    const n = price.length - 1;

    // Bandwidth = (upper − lower) / middle, normalised so it compares across symbols.
    const widths: number[] = [];
    for (let i = 0; i <= n; i++) {
      if (!Number.isNaN(upper[i]) && middle[i] !== 0) {
        widths.push((upper[i] - lower[i]) / middle[i]);
      }
    }
    if (widths.length < 10) return neutral(this.id, symbol, at, 'Not enough band history');

    const recent = widths.slice(-20);
    const currentWidth = widths[widths.length - 1];
    const minWidth = Math.min(...recent);
    const squeezing = currentWidth <= minWidth * 1.1; // within 10% of the tightest

    if (!squeezing) return makeSignal(this.id, symbol, at, 'neutral', 0.3, 'No volatility squeeze');

    const last = price[n];
    if (last >= upper[n]) {
      return makeSignal(this.id, symbol, at, 'long', 0.78, 'Squeeze breakout through the upper band');
    }
    if (last <= lower[n]) {
      return makeSignal(this.id, symbol, at, 'short', 0.78, 'Squeeze breakdown through the lower band');
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.4, 'Squeeze detected — awaiting direction');
  },
};
