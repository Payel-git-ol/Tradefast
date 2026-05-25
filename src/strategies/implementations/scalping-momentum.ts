import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { rsi } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Scalping momentum: fade RSI extremes only once momentum starts turning back,
 * i.e. an oversold reading that is already ticking up (long) or an overbought
 * reading already ticking down (short).
 */
export const scalpingMomentum: Strategy = {
  id: 'scalping-momentum',
  title: 'Scalping Momentum (RSI)',
  minCandles: 20,

  evaluate(candles, symbol, _params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const series = rsi(closes(candles), 14);
    const current = series[series.length - 1];
    const previous = series[series.length - 2];
    if (Number.isNaN(current) || Number.isNaN(previous)) {
      return neutral(this.id, symbol, at, 'RSI not ready');
    }

    if (current < 30 && current > previous) {
      return makeSignal(this.id, symbol, at, 'long', 0.7,
        `RSI oversold bounce at ${current.toFixed(1)}`, 0.3);
    }
    if (current > 70 && current < previous) {
      return makeSignal(this.id, symbol, at, 'short', 0.7,
        `RSI overbought reversal at ${current.toFixed(1)}`, 0.3);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.4, `RSI at ${current.toFixed(1)} — no extreme`);
  },
};
