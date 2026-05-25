/**
 * A single, project-wide Math.js instance configured for high-precision,
 * deterministic arithmetic.
 *
 * Indicator arrays use native `number` for speed, but every value that touches
 * money or position sizing is computed through BigNumber here so rounding is
 * predictable and reproducible — the calculation accuracy the project requires.
 */
import { create, all, type BigNumber, type MathJsInstance } from 'mathjs';

export const mathx: MathJsInstance = create(all, {
  number: 'BigNumber',
  precision: 64,
});

/** Convert any numeric input to a BigNumber. */
export const big = (value: number | string | BigNumber): BigNumber => mathx.bignumber(value);

/**
 * Round a BigNumber to a fixed number of decimal places and return a JS number.
 * Used at the boundary where results leave the precise domain (e.g. quantities).
 */
export const round = (value: BigNumber, decimals: number): number =>
  Number(mathx.format(mathx.round(value, decimals), { notation: 'fixed', precision: decimals }));

export type { BigNumber };
