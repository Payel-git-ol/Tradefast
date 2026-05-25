import { describe, expect, it } from 'vitest';

import { Money } from '../src/domain/money.js';
import { calculatePositionSize } from '../src/strategies/position-sizer.js';

describe('Money (BigNumber exactness)', () => {
  it('adds without binary floating-point drift', () => {
    const sum = Money.of('0.1').add(Money.of('0.2'));
    // 0.1 + 0.2 === 0.3 exactly, where native floats give 0.30000000000000004.
    expect(sum.toNumber(2)).toBe(0.3);
  });

  it('multiplies exactly', () => {
    expect(Money.of('19.99').multiply(3).toNumber(2)).toBe(59.97);
  });

  it('rejects mixing currencies', () => {
    expect(() => Money.of('1', 'USD').add(Money.of('1', 'EUR'))).toThrow(/Currency mismatch/);
  });
});

describe('position sizing', () => {
  it('risks exactly risk% of equity over the stop distance', () => {
    // equity 10000, risk 1% → $100 at risk; stop distance 50 → 2 units.
    const size = calculatePositionSize({
      accountBalance: 10_000,
      riskPercent: 1,
      entryPrice: 1_000,
      stopPrice: 950,
    });
    expect(size.riskAmount.toNumber(2)).toBe(100);
    expect(size.stopDistance).toBe(50);
    expect(size.quantity).toBeCloseTo(2, 8);
    expect(size.notional.toNumber(2)).toBe(2_000);
  });

  it('falls back to an ATR-based stop when entry equals stop', () => {
    // No usable stop → ATR(20) * 1.5 = 30 distance; $50 risk / 30 = 1.66666667.
    const size = calculatePositionSize({
      accountBalance: 10_000,
      riskPercent: 0.5,
      entryPrice: 1_000,
      stopPrice: 1_000,
      atr: 20,
      atrMultiplier: 1.5,
    });
    expect(size.stopDistance).toBe(30);
    expect(size.quantity).toBeCloseTo(50 / 30, 6);
  });

  it('falls back to a 2% hard stop when neither stop nor ATR is usable', () => {
    const size = calculatePositionSize({
      accountBalance: 10_000,
      riskPercent: 1,
      entryPrice: 1_000,
      stopPrice: 1_000,
    });
    expect(size.stopDistance).toBe(20); // 2% of 1000
  });

  it('returns a zero position for non-positive inputs', () => {
    const size = calculatePositionSize({
      accountBalance: 0,
      riskPercent: 1,
      entryPrice: 1_000,
      stopPrice: 950,
    });
    expect(size.quantity).toBe(0);
    expect(size.notional.isZero).toBe(true);
    expect(size.riskAmount.isZero).toBe(true);
  });
});
