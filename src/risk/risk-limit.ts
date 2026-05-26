import { Money } from '../domain/money.js';

/**
 * The hard guardrails that keep the trader disciplined. Defaults are
 * deliberately conservative — the system's job is to prevent impulsive,
 * oversized risk, not to encourage it.
 */
export interface RiskLimit {
  dailyLossLimit: Money;
  maxPositionSize: Money;
  maxRiskPerTradePercent: number;
}

export const defaultRiskLimit = (accountBalance = 10_000): RiskLimit => ({
  dailyLossLimit: Money.of(Math.max(100, Math.round(accountBalance * 0.01))),
  maxPositionSize: Money.of(Math.round(accountBalance)),
  maxRiskPerTradePercent: 1,
});
