import type { Candle } from '../domain/candle.js';
import { lastCandle } from '../domain/candle.js';
import { DEFAULT_PARAMETERS, type StrategyParameters, type TradingSignal } from '../domain/signal.js';
import { StrategyEngine } from '../strategies/engine.js';
import { atr, lastDefined } from '../strategies/indicators.js';
import { calculatePositionSize, type PositionSize } from '../strategies/position-sizer.js';
import { RiskValidator, type RiskCheckResult } from './risk-validator.js';

export interface EvaluatedSignal {
  signal: TradingSignal;
  position?: PositionSize;
  risk?: RiskCheckResult;
  status: string;
}

export interface OrchestratorOptions {
  accountBalance?: number;
  params?: StrategyParameters;
  atrMultiplier?: number;
}

/**
 * Routes every strategy signal through volatility-aware position sizing and the
 * mandatory risk layer. Neutral or low-confidence signals are skipped before
 * they ever reach sizing — this is the discipline gate of the whole system.
 */
export class StrategyRiskOrchestrator {
  constructor(
    private readonly engine: StrategyEngine = new StrategyEngine(),
    private readonly risk: RiskValidator = new RiskValidator(),
  ) {}

  evaluate(candles: readonly Candle[], symbol: string, options: OrchestratorOptions = {}): EvaluatedSignal[] {
    const params = options.params ?? DEFAULT_PARAMETERS;
    const accountBalance = options.accountBalance ?? 10_000;
    const atrMultiplier = options.atrMultiplier ?? 1.5;

    const signals = this.engine.evaluateAll(candles, symbol, params);
    const last = lastCandle(candles);
    if (!last) return signals.map((signal) => ({ signal, status: 'Skipped (no candles)' }));

    const currentAtr = lastDefined(atr(candles, 14));
    const entry = last.close;

    return signals.map((signal) => {
      if (signal.direction === 'neutral' || signal.strength < params.threshold) {
        return { signal, status: 'Skipped (neutral or below threshold)' };
      }

      const stopDistance = currentAtr > 0 ? currentAtr * atrMultiplier : entry * 0.02;
      const stopPrice = signal.direction === 'long' ? entry - stopDistance : entry + stopDistance;
      const riskPercent = signal.suggestedRiskPercent > 0 ? signal.suggestedRiskPercent : params.riskPercent;

      const position = calculatePositionSize({
        accountBalance,
        riskPercent,
        entryPrice: entry,
        stopPrice,
        atr: currentAtr,
        atrMultiplier,
      });

      const risk = this.risk.validate({
        symbol,
        direction: signal.direction,
        notional: position.notional,
        riskAmount: position.riskAmount,
        riskPercent,
      }, accountBalance);

      return {
        signal,
        position,
        risk,
        status: risk.approved ? 'Approved by risk' : 'Rejected by risk',
      };
    });
  }
}
