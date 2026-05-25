/**
 * A validated trading symbol such as `BTCUSDT`. Normalised to upper case so the
 * rest of the system can treat it as a canonical key.
 */
export class Symbol {
  private constructor(readonly value: string) {}

  static create(raw: string): Symbol {
    const upper = raw.trim().toUpperCase();
    if (upper.length < 3 || upper.length > 20) {
      throw new Error('Symbol length must be between 3 and 20 characters');
    }
    if (!/^[A-Z0-9]+$/.test(upper)) {
      throw new Error('Symbol may only contain letters and digits');
    }
    return new Symbol(upper);
  }

  toString(): string {
    return this.value;
  }
}
