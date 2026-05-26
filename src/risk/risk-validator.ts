import { Money } from '../domain/money.js';
import { defaultRiskLimit, type RiskLimit } from './risk-limit.js';

export interface ProposedTrade {
  symbol: string;
  direction: 'long' | 'short';
  notional: Money;
  riskAmount: Money;
  riskPercent: number;
}

export interface RiskCheckResult {
  approved: boolean;
  reasons: string[];
}

/**
 * Validates a proposed trade against the risk limits before it could ever be
 * acted on. Pure and synchronous so it is trivial to test and to reason about.
 */
export class RiskValidator {
  private limit: RiskLimit;

  constructor(accountBalance?: number) {
    this.limit = defaultRiskLimit(accountBalance);
  }

  validate(trade: ProposedTrade, accountBalance?: number): RiskCheckResult {
    if (accountBalance != null) this.limit = defaultRiskLimit(accountBalance);
    const reasons: string[] = [];

    if (trade.notional.isGreaterThan(this.limit.maxPositionSize)) {
      reasons.push(
        `Position ${trade.notional} exceeds max position size ${this.limit.maxPositionSize}`,
      );
    }
    if (trade.riskPercent > this.limit.maxRiskPerTradePercent) {
      reasons.push(
        `Risk ${trade.riskPercent}% exceeds max risk per trade ${this.limit.maxRiskPerTradePercent}%`,
      );
    }
    if (trade.riskAmount.isGreaterThan(this.limit.dailyLossLimit)) {
      reasons.push(
        `Risked ${trade.riskAmount} exceeds the daily loss limit ${this.limit.dailyLossLimit}`,
      );
    }

    return { approved: reasons.length === 0, reasons };
  }
}
