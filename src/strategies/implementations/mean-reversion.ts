import type { Strategy } from '../strategy.js';
import { closes, lastCandle } from '../../domain/candle.js';
import { neutral } from '../../domain/signal.js';
import { bollingerBands, lastDefined } from '../indicators.js';
import { makeSignal } from '../helpers.js';

/**
 * Mean reversion: fade moves that stretch outside the Bollinger Bands, expecting
 * price to revert toward the moving-average mid-band.
 */
export const meanReversion: Strategy = {
  id: 'mean-reversion',
  title: 'Mean Reversion (Bollinger)',
  minCandles: 30,

  evaluate(candles, symbol, params) {
    const at = lastCandle(candles)?.openTime ?? Date.now();
    if (candles.length < this.minCandles) return neutral(this.id, symbol, at, 'Not enough data');

    const price = closes(candles);
    const last = price[price.length - 1];
    const { upper, middle, lower } = bollingerBands(price, params.lookback, 2);
    const u = lastDefined(upper);
    const m = lastDefined(middle);
    const l = lastDefined(lower);

    if (last > u) {
      const overshoot = (last - u) / (u - m || 1);
      return makeSignal(this.id, symbol, at, 'short', 0.7 + overshoot * 0.2,
        'Price closed above the upper Bollinger Band — reversion short');
    }
    if (last < l) {
      const overshoot = (l - last) / (m - l || 1);
      return makeSignal(this.id, symbol, at, 'long', 0.7 + overshoot * 0.2,
        'Price closed below the lower Bollinger Band — reversion long');
    }
    return makeSignal(this.id, symbol, at, 'neutral', 0.3, 'Price inside the Bollinger range');
  },
};
