import type { Strategy } from '../strategy.js';
import { lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { donchian } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Donchian breakout (the classic "Turtle" entry): go long when price makes a new
 * `lookback`-bar high, short on a new `lookback`-bar low. Unlike the plain
 * breakout strategy this uses the channel computed up to the prior bar, so a
 * touch of the channel edge by the current bar is the trigger.
 */
export const donchianBreakout: Strategy = {
  id: 'donchian-breakout',
  title: 'Donchian Breakout (Turtle)',
  minCandles: 30,

  evaluate(candles, symbol, params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const period = params.lookback;
    // Channel from the bars *before* the current one, so it acts as a trigger.
    const prior = candles.slice(0, -1);
    const channel = donchian(prior, period);
    const upper = channel.upper[channel.upper.length - 1];
    const lower = channel.lower[channel.lower.length - 1];
    const current = candles[candles.length - 1];

    if (current.high >= upper) {
      return makeSignal(this.id, symbol, at, 'long', 0.8, `New ${period}-bar high — Donchian breakout long`);
    }
    if (current.low <= lower) {
      return makeSignal(this.id, symbol, at, 'short', 0.8, `New ${period}-bar low — Donchian breakout short`);
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.25, 'Price inside the Donchian channel');
  },
};
