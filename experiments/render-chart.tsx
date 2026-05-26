/**
 * Render the candlestick chart to a terminal frame for visual inspection.
 * Run: npx tsx experiments/render-chart.tsx
 */
import React from 'react';
import { render } from 'ink-testing-library';

import { CandleChartView } from '../src/cli/chart.js';
import type { Candle } from '../src/domain/candle.js';
import { getTheme } from '../src/cli/theme.js';

// Synthetic candles resembling the issue screenshot: a rise then a sell-off.
function makeCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let price = 76800;
  for (let i = 0; i < n; i++) {
    const phase = i / n;
    const drift = Math.sin(phase * Math.PI) * 1100 - (phase > 0.7 ? (phase - 0.7) * 4000 : 0);
    const target = 76800 + drift;
    const open = price;
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 120;
    const close = target + noise;
    const high = Math.max(open, close) + Math.abs(Math.sin(i * 2.3)) * 160 + 40;
    const low = Math.min(open, close) - Math.abs(Math.cos(i * 1.9)) * 160 - 40;
    out.push({ openTime: 1700000000000 + i * 3600000, open, high, low, close, volume: 100 });
    price = close;
  }
  return out;
}

const stdout = { rows: 40, columns: 100, write: () => {}, on: () => {}, removeListener: () => {} } as any;
const candles = makeCandles(50);
const { lastFrame, unmount } = render(
  <CandleChartView data={{ symbol: 'BTCUSDT', interval: '1h', candles }} theme={getTheme('violet')} />,
  { stdout },
);

// eslint-disable-next-line no-console
console.log(lastFrame());
unmount();
