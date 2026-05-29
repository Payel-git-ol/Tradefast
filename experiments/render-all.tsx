import { renderTradeLogLines } from '../src/cli/trade-log.js';
const base: any = {
  runId: 34, kind: 'start', searchResults: 3, durationMs: 2340, validation: null,
  symbols: [{
    symbol: 'BTCUSDT', candlesAdded: 200, signalsInserted: 13, signalsUpdated: 0,
    signalsUnchanged: 0, scrapesAdded: 0, insight: 'hidden in table view', assessment: 'Momentum favours longs',
    analysis: { symbol: 'BTCUSDT',
      analytics: { symbol: 'BTCUSDT', consensusScore: 0.17, longCount: 1, shortCount: 0, neutralCount: 12, strongestStrategy: 'pullback', strongestStrength: 0.72, lastPrice: 100, atr: 3.33 },
      evaluated: [{ status: 'Approved by risk',
        signal: { symbol: 'BTCUSDT', strategy: 'pullback', direction: 'long', strength: 0.72, reason: 'pullback', suggestedRiskPercent: 0.5, at: 1 },
        position: { quantity: 10, notional: null, riskAmount: null, stopDistance: 5 },
        risk: { approved: true, reasons: [] } }] } }],
};
const short = JSON.parse(JSON.stringify(base));
short.symbols[0].analysis.evaluated[0].signal.direction = 'short';
const noaction = JSON.parse(JSON.stringify(base));
noaction.symbols[0].analysis.evaluated[0].position = null;
noaction.symbols[0].analysis.evaluated[0].risk = null;
console.log('=== LONG ===');
for (const l of renderTradeLogLines(base)) console.log(JSON.stringify(l));
console.log('=== SHORT ===');
for (const l of renderTradeLogLines(short)) console.log(JSON.stringify(l));
console.log('=== NOACTION ===');
for (const l of renderTradeLogLines(noaction)) console.log(JSON.stringify(l));
