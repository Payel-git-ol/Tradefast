import { describe, expect, it } from 'vitest';

import type { Candle } from '../src/domain/candle.js';
import {
  atr,
  bollingerBands,
  ema,
  lastDefined,
  linearRegressionSlope,
  macd,
  rsi,
  sma,
  trueRange,
  vwap,
} from '../src/strategies/indicators.js';

const flat = (close: number, range = 2): Candle => ({
  openTime: 0,
  open: close,
  high: close + range / 2,
  low: close - range / 2,
  close,
  volume: 10,
});

describe('moving averages', () => {
  it('SMA pads with NaN and averages the trailing window', () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2).every(Number.isNaN)).toBe(true);
    expect(out.slice(2)).toEqual([2, 3, 4]);
  });

  it('EMA is seeded with the SMA of the first window (no first-price drift)', () => {
    // seed = mean(1,2,3) = 2; k = 0.5 → 4*.5+2*.5=3 ; 5*.5+3*.5=4
    expect(ema([1, 2, 3, 4, 5], 3).slice(2)).toEqual([2, 3, 4]);
  });
});

describe('RSI', () => {
  it('is 100 for a monotonically rising series', () => {
    const rising = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(lastDefined(rsi(rising, 14))).toBeCloseTo(100, 6);
  });

  it('approaches 0 for a monotonically falling series', () => {
    const falling = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(lastDefined(rsi(falling, 14))).toBeLessThan(1);
  });

  it('stays within [0, 100]', () => {
    const noisy = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5 + (i % 3));
    for (const v of rsi(noisy, 14)) {
      if (!Number.isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('ATR / true range', () => {
  it('equals the constant range when every candle has the same range', () => {
    const candles = Array.from({ length: 30 }, () => flat(100, 4));
    // True range collapses to high-low = 4 (prev close is also 100).
    expect(lastDefined(trueRange(candles))).toBeCloseTo(4, 6);
    expect(lastDefined(atr(candles, 14))).toBeCloseTo(4, 6);
  });
});

describe('Bollinger Bands', () => {
  it('collapse onto the mean when volatility is zero', () => {
    const flatValues = new Array(25).fill(50);
    const { upper, middle, lower } = bollingerBands(flatValues, 20, 2);
    expect(lastDefined(middle)).toBeCloseTo(50, 6);
    expect(lastDefined(upper)).toBeCloseTo(50, 6);
    expect(lastDefined(lower)).toBeCloseTo(50, 6);
  });
});

describe('MACD', () => {
  it('keeps histogram = macd - signal wherever both are defined', () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const { macd: line, signal, histogram } = macd(values);
    for (let i = 0; i < values.length; i++) {
      if (!Number.isNaN(signal[i])) {
        expect(histogram[i]).toBeCloseTo(line[i] - signal[i], 9);
      }
    }
  });
});

describe('VWAP', () => {
  it('equals the constant typical price for a flat series', () => {
    const candles = Array.from({ length: 10 }, () => flat(100, 0));
    expect(lastDefined(vwap(candles))).toBeCloseTo(100, 6);
  });
});

describe('linear regression slope', () => {
  it('recovers the exact slope of a straight line', () => {
    expect(linearRegressionSlope([0, 2, 4, 6, 8])).toBeCloseTo(2, 9);
    expect(linearRegressionSlope([10, 8, 6, 4])).toBeCloseTo(-2, 9);
    expect(linearRegressionSlope([5, 5, 5, 5])).toBeCloseTo(0, 9);
  });
});
