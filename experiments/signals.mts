import { SyntheticMarketData } from '../src/services/market-data.js';
import { StrategyEngine } from '../src/strategies/engine.js';
const md = new SyntheticMarketData();
const eng = new StrategyEngine();
for (const sym of ['BTCUSDT','ETHUSDT','SOLUSDT']) {
  const c = await md.getCandles(sym, '1h', 200);
  const first = c[0].close.toFixed(2), last = c[c.length-1].close.toFixed(2);
  const cons = eng.consensus(c, sym);
  console.log(sym, 'first', first, 'last', last, 'consensus', cons.score.toFixed(3), 'L/S/N', cons.long, cons.short, cons.neutral);
  const sigs = eng.evaluateAll(c, sym).filter(s=>s.direction!=='neutral');
  for (const s of sigs) console.log('   ', s.strategy, s.direction, s.strength.toFixed(2));
}
