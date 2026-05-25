import type { Strategy } from './strategy.js';
import type { StrategyId } from '../domain/signal.js';
import { trendFollowing } from './implementations/trend-following.js';
import { meanReversion } from './implementations/mean-reversion.js';
import { breakout } from './implementations/breakout.js';
import { scalpingMomentum } from './implementations/scalping-momentum.js';
import { smartMoney } from './implementations/smart-money.js';
import { supportResistance } from './implementations/support-resistance.js';
import { pullback } from './implementations/pullback.js';
import { macdMomentum } from './implementations/macd-momentum.js';
import { donchianBreakout } from './implementations/donchian-breakout.js';
import { bollingerSqueeze } from './implementations/bollinger-squeeze.js';
import { stochasticReversal } from './implementations/stochastic-reversal.js';
import { vwapReversion } from './implementations/vwap-reversion.js';
import { grid } from './implementations/grid.js';

/**
 * The complete catalogue of strategies. New strategies become available across
 * the whole app simply by adding them here (open/closed principle).
 */
export const ALL_STRATEGIES: readonly Strategy[] = [
  trendFollowing,
  meanReversion,
  breakout,
  scalpingMomentum,
  smartMoney,
  supportResistance,
  pullback,
  macdMomentum,
  donchianBreakout,
  bollingerSqueeze,
  stochasticReversal,
  vwapReversion,
  grid,
];

const byId = new Map<StrategyId, Strategy>(ALL_STRATEGIES.map((s) => [s.id, s]));

export const getStrategy = (id: StrategyId): Strategy | undefined => byId.get(id);
