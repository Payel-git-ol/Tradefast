import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { linearRegressionSlope } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Grid trading (range mode): only active inside a confirmed range — a flat
 * regression slope. Within that range it buys in the lower grid band and sells
 * in the upper band, earning the oscillation. It deliberately stays neutral in
 * trends, where ungridded exposure is dangerous.
 */
export const grid: Strategy = {
  id: 'grid',
  title: 'Grid (Range)',
  minCandles: 30,

  evaluate(candles, symbol, params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const window = candles.slice(-params.lookback);
    const price = closes(candles);
    const last = price[price.length - 1];
    const high = Math.max(...window.map((c) => c.high));
    const low = Math.min(...window.map((c) => c.low));
    const range = high - low;
    if (range === 0) return neutral(this.id, symbol, at, 'Flat range');

    // Reject trending markets: normalise slope by price.
    const slope = linearRegressionSlope(window.map((c) => c.close));
    const trendStrength = Math.abs((slope / last) * 100);
    if (trendStrength > 0.15) {
      return makeSignal(this.id, symbol, at, 'neutral', 0.2, 'Trend detected — grid stays out');
    }

    const position = (last - low) / range; // 0 = bottom of range, 1 = top
    if (position <= 0.25) {
      return makeSignal(this.id, symbol, at, 'long', 0.6, 'Lower grid band inside range — accumulate', 0.3);
    }
    if (position >= 0.75) {
      return makeSignal(this.id, symbol, at, 'short', 0.6, 'Upper grid band inside range — distribute', 0.3);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.3, 'Mid-range — no grid edge');
  },
};
