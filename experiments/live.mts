import { BinanceMarketData } from '../src/services/market-data.js';
import { StrategyEngine } from '../src/strategies/engine.js';
const md = new BinanceMarketData();
const eng = new StrategyEngine();
const c = await md.getCandles('BTCUSDT', '1h', 200);
console.log('candles', c.length, 'first', c[0].close, 'last', c[c.length-1].close);
for (const s of eng.evaluateAll(c, 'BTCUSDT')) {
  console.log(s.strategy.padEnd(20), s.direction.padEnd(8), s.strength.toFixed(2), '-', s.reason.slice(0,60));
}
