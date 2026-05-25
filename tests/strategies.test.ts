import { describe, expect, it } from 'vitest';

import type { Candle } from '../src/domain/candle.js';
import { DEFAULT_PARAMETERS } from '../src/domain/signal.js';
import { StrategyEngine } from '../src/strategies/engine.js';
import { ALL_STRATEGIES } from '../src/strategies/registry.js';
import { trendFollowing } from '../src/strategies/implementations/trend-following.js';

/** Build a candle series from a list of close prices (tight, well-formed bars). */
const series = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({
    openTime: i * 3_600_000,
    open: i === 0 ? close : closes[i - 1],
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 1_000,
  }));

const upTrend = series(Array.from({ length: 80 }, (_, i) => 100 + i * 2));
const downTrend = series(Array.from({ length: 80 }, (_, i) => 300 - i * 2));

describe('trend-following strategy', () => {
  it('goes long on a clean uptrend', () => {
    const signal = trendFollowing.evaluate(upTrend, 'TEST', DEFAULT_PARAMETERS);
    expect(signal.direction).toBe('long');
    expect(signal.strength).toBeGreaterThan(0);
  });

  it('goes short on a clean downtrend', () => {
    const signal = trendFollowing.evaluate(downTrend, 'TEST', DEFAULT_PARAMETERS);
    expect(signal.direction).toBe('short');
    expect(signal.strength).toBeGreaterThan(0);
  });

  it('is neutral when there is not enough data', () => {
    const signal = trendFollowing.evaluate(series([100, 101, 102]), 'TEST', DEFAULT_PARAMETERS);
    expect(signal.direction).toBe('neutral');
  });
});

describe('strategy engine', () => {
  const engine = new StrategyEngine();

  it('runs every registered strategy without throwing', () => {
    const signals = engine.evaluateAll(upTrend, 'TEST');
    expect(signals).toHaveLength(ALL_STRATEGIES.length);
    for (const s of signals) {
      expect(s.strength).toBeGreaterThanOrEqual(0);
      expect(s.strength).toBeLessThanOrEqual(1);
    }
  });

  it('reaches a bullish consensus on an uptrend', () => {
    const { score, long, short } = engine.consensus(upTrend, 'TEST');
    expect(score).toBeGreaterThan(0);
    expect(long).toBeGreaterThanOrEqual(short);
  });

  it('reaches a bearish consensus on a downtrend', () => {
    const { score, long, short } = engine.consensus(downTrend, 'TEST');
    expect(score).toBeLessThan(0);
    expect(short).toBeGreaterThanOrEqual(long);
  });

  it('degrades a throwing strategy to neutral instead of failing the run', () => {
    const boom = {
      id: 'trend-following' as const,
      title: 'Boom',
      minCandles: 0,
      evaluate() {
        throw new Error('kaboom');
      },
    };
    const signals = new StrategyEngine([boom]).evaluateAll(upTrend, 'TEST');
    expect(signals[0].direction).toBe('neutral');
    expect(signals[0].reason).toContain('kaboom');
  });
});
