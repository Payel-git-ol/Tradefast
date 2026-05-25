import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { macd } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * MACD momentum: trade the MACD/signal-line crossover. A fresh bullish cross
 * (MACD rising above signal) goes long; a bearish cross goes short. Strength
 * scales with the size of the histogram relative to price.
 */
export const macdMomentum: Strategy = {
  id: 'macd-momentum',
  title: 'MACD Momentum',
  minCandles: 40,

  evaluate(candles, symbol, _params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const price = closes(candles);
    const { macd: line, signal, histogram } = macd(price);
    const n = price.length - 1;
    const histNow = histogram[n];
    const histPrev = histogram[n - 1];
    if (Number.isNaN(histNow) || Number.isNaN(histPrev)) {
      return neutral(this.id, symbol, at, 'MACD not ready');
    }

    const strength = Math.min(0.9, Math.abs(histNow / price[n]) * 200 + 0.5);
    // A crossover is a sign change in the histogram (MACD − signal).
    if (histPrev <= 0 && histNow > 0) {
      return makeSignal(this.id, symbol, at, 'long', strength,
        `Bullish MACD crossover (MACD ${line[n].toFixed(4)} > signal ${signal[n].toFixed(4)})`);
    }
    if (histPrev >= 0 && histNow < 0) {
      return makeSignal(this.id, symbol, at, 'short', strength,
        `Bearish MACD crossover (MACD ${line[n].toFixed(4)} < signal ${signal[n].toFixed(4)})`);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.3, 'No MACD crossover');
  },
};
