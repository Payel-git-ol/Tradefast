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

export const defaultRiskLimit = (): RiskLimit => ({
  dailyLossLimit: Money.of(100),
  maxPositionSize: Money.of(500),
  maxRiskPerTradePercent: 1,
});
