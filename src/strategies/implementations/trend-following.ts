import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { lastDefined, linearRegressionSlope, sma } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Trend following: trade in the direction of an established trend.
 * Long when price is above both the SMA-20 and SMA-50 and the short-term slope
 * is positive; short on the mirror condition. Strength scales with slope.
 */
export const trendFollowing: Strategy = {
  id: 'trend-following',
  title: 'Trend Following',
  minCandles: 50,

  evaluate(candles, symbol, params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const price = closes(candles);
    const last = price[price.length - 1];
    const sma20 = lastDefined(sma(price, 20));
    const sma50 = lastDefined(sma(price, 50));
    const slope = linearRegressionSlope(price.slice(-params.lookback));
    // Normalise slope by price so the strength is comparable across symbols.
    const normSlope = (slope / last) * 100;

    const aboveBoth = last > sma20 && last > sma50;
    const belowBoth = last < sma20 && last < sma50;

    if (slope > 0 && aboveBoth) {
      return makeSignal(this.id, symbol, at, 'long', Math.abs(normSlope) * 2,
        'Price above SMA20 & SMA50 with positive slope (higher-highs structure)');
    }
    if (slope < 0 && belowBoth) {
      return makeSignal(this.id, symbol, at, 'short', Math.abs(normSlope) * 2,
        'Price below SMA20 & SMA50 with negative slope (lower-lows structure)');
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.2, 'No clear trend structure');
  },
};
