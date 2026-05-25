import type { Candle } from '../domain/candle.js';
import { lastCandle } from '../domain/candle.js';
import { DEFAULT_PARAMETERS, type StrategyParameters } from '../domain/signal.js';
import { StrategyRiskOrchestrator, type EvaluatedSignal } from '../risk/orchestrator.js';
import { StrategyEngine } from '../strategies/engine.js';
import { atr, lastDefined } from '../strategies/indicators.js';
import type { AnalyticsRow } from '../db/store.js';

export interface SymbolAnalysis {
  symbol: string;
  analytics: AnalyticsRow;
  evaluated: EvaluatedSignal[];
}

/**
 * Turns a candle series into the aggregate analytics persisted per run: the
 * weighted directional consensus, the long/short/neutral tally, the strongest
 * strategy and the latest price/ATR. Strategy evaluation and risk routing are
 * delegated to the engine and orchestrator so the math lives in exactly one
 * place.
 */
export class AnalyticsService {
  constructor(
    private readonly engine: StrategyEngine = new StrategyEngine(),
    private readonly orchestrator: StrategyRiskOrchestrator = new StrategyRiskOrchestrator(engine),
  ) {}

  analyze(
    candles: readonly Candle[],
    symbol: string,
    params: StrategyParameters = DEFAULT_PARAMETERS,
    accountBalance = 10_000,
  ): SymbolAnalysis {
    const consensus = this.engine.consensus(candles, symbol, params);
    const evaluated = this.orchestrator.evaluate(candles, symbol, { params, accountBalance });

    let strongestStrategy: string | null = null;
    let strongestStrength = 0;
    for (const { signal } of evaluated) {
      if (signal.direction !== 'neutral' && signal.strength > strongestStrength) {
        strongestStrength = signal.strength;
        strongestStrategy = signal.strategy;
      }
    }

    const last = lastCandle(candles);
    const currentAtr = lastDefined(atr(candles, 14));

    return {
      symbol,
      evaluated,
      analytics: {
        symbol,
        consensusScore: consensus.score,
        longCount: consensus.long,
        shortCount: consensus.short,
        neutralCount: consensus.neutral,
        strongestStrategy,
        strongestStrength: strongestStrategy ? strongestStrength : null,
        lastPrice: last?.close ?? null,
        atr: Number.isNaN(currentAtr) ? null : currentAtr,
      },
    };
  }
}
