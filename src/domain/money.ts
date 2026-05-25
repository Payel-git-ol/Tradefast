import { big, mathx, type BigNumber } from '../strategies/mathx.js';

/**
 * A precise monetary amount. Arithmetic is performed with Math.js BigNumber to
 * avoid binary floating-point drift (e.g. 0.1 + 0.2 !== 0.3).
 */
export class Money {
  private constructor(
    private readonly amount: BigNumber,
    readonly currency: string,
  ) {}

  static of(amount: number | string, currency = 'USD'): Money {
    return new Money(big(amount), currency.toUpperCase());
  }

  static zero(currency = 'USD'): Money {
    return new Money(big(0), currency.toUpperCase());
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(mathx.add(this.amount, other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(mathx.subtract(this.amount, other.amount), this.currency);
  }

  multiply(factor: number | string): Money {
    return new Money(mathx.multiply(this.amount, big(factor)) as BigNumber, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return mathx.larger(this.amount, other.amount) as boolean;
  }

  get isZero(): boolean {
    return mathx.equal(this.amount, big(0)) as boolean;
  }

  /** Numeric value rounded to `decimals` places (default 2). */
  toNumber(decimals = 2): number {
    return Number(mathx.format(mathx.round(this.amount, decimals), { notation: 'fixed', precision: decimals }));
  }

  toString(): string {
    return `${this.toNumber(2).toFixed(2)} ${this.currency}`;
  }
}
