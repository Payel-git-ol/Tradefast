import { big, mathx, round, type BigNumber } from './mathx.js';
import { Money } from '../domain/money.js';

export interface PositionSizeInput {
  /** Account equity available for risk, in quote currency (e.g. USD). */
  accountBalance: number;
  /** Fraction of equity to risk on the trade, as a percentage (0.5 = 0.5%). */
  riskPercent: number;
  entryPrice: number;
  stopPrice: number;
  /** Optional ATR used to derive a stop when an explicit stop is not given. */
  atr?: number;
  atrMultiplier?: number;
}

export interface PositionSize {
  /** Notional value of the position (quantity * entry), as Money. */
  notional: Money;
  /** Base-asset quantity to buy/sell. */
  quantity: number;
  /** The risked amount in quote currency, as Money. */
  riskAmount: Money;
  /** The stop distance actually used (after ATR / fallback logic). */
  stopDistance: number;
}

/**
 * Volatility-aware position sizing — the core of disciplined risk management.
 *
 * quantity = (equity * risk%) / stopDistance
 *
 * All arithmetic runs through Math.js BigNumber so the risked amount and
 * resulting quantity are exact and reproducible. When no valid stop is given we
 * fall back to an ATR-based stop, then to a 2% hard stop.
 */
export function calculatePositionSize(input: PositionSizeInput): PositionSize {
  const { accountBalance, riskPercent, entryPrice, stopPrice } = input;
  const atrMultiplier = input.atrMultiplier ?? 1.5;

  if (accountBalance <= 0 || riskPercent <= 0 || entryPrice <= 0) {
    return { notional: Money.zero(), quantity: 0, riskAmount: Money.zero(), stopDistance: 0 };
  }

  let stopDistance: BigNumber = mathx.abs(mathx.subtract(big(entryPrice), big(stopPrice))) as BigNumber;
  const tiny = big('0.00000001');

  if ((mathx.smaller(stopDistance, tiny) as boolean) && input.atr && input.atr > 0) {
    stopDistance = mathx.multiply(big(input.atr), big(atrMultiplier)) as BigNumber;
  }
  if (mathx.smaller(stopDistance, tiny) as boolean) {
    stopDistance = mathx.multiply(big(entryPrice), big('0.02')) as BigNumber; // 2% hard stop
  }

  const riskAmount = mathx.multiply(big(accountBalance), mathx.divide(big(riskPercent), big(100))) as BigNumber;
  const quantityExact = mathx.divide(riskAmount, stopDistance) as BigNumber;
  const quantity = round(quantityExact, 8);
  const notional = mathx.multiply(big(quantity), big(entryPrice)) as BigNumber;

  return {
    notional: Money.of(round(notional, 2)),
    quantity,
    riskAmount: Money.of(round(riskAmount, 2)),
    stopDistance: round(stopDistance, 8),
  };
}
