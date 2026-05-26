/**
 * Generate a colored before/after HTML comparison of the candlestick chart.
 * Run: npx tsx experiments/chart-before-after.tsx
 * Output: experiments/chart-before-after.html
 *
 * "Before" reproduces the earlier single-column candles (PR #20, first pass)
 * that the maintainer called too small; "After" is the wide, taller chart.
 */
import { writeFileSync } from 'node:fs';

import type { Candle } from '../src/domain/candle.js';
import { buildChartLayout } from '../src/cli/chart.js';

const LONG = '#22c55e';
const SHORT = '#ef4444';
const MUTED = '#9ca3af';
const ACCENT = '#c084fc';

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

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (s: string, color?: string): string => `<span style="color:${color ?? MUTED}">${esc(s)}</span>`;

/** Render a chart with the given geometry to a colored HTML block. */
function panel(candles: Candle[], opts: { height: number; candleWidth: number; gap: number; maxCandles: number }): string {
  const { rows, footer, shown } = buildChartLayout(candles, { ...opts, labelWidth: 8 });
  const lines: string[] = [span(`BTCUSDT · 1h · last ${shown} candles`, ACCENT)];
  for (const r of rows) {
    let line = span(r.label + ' ', MUTED);
    for (const cell of r.cells) {
      line += cell.up === null ? ' ' : span(cell.ch, cell.up ? LONG : SHORT);
    }
    lines.push(line);
  }
  lines.push(span(' '.repeat(9) + footer, MUTED));
  return lines.join('\n');
}

const candles = makeCandles(60);

const before = panel(candles, { height: 12, candleWidth: 1, gap: 0, maxCandles: 50 });
const after = panel(candles, { height: 18, candleWidth: 3, gap: 1, maxCandles: 26 });

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { background:#0b0e14; margin:0; padding:24px; font-family: 'DejaVu Sans Mono','Menlo','Consolas',monospace; }
  h2 { color:#e5e7eb; font-family: sans-serif; font-size:15px; margin:18px 0 6px; }
  .panel { border:1px solid #6b7280; border-radius:8px; padding:10px 14px; display:inline-block; }
  pre { margin:0; font-size:14px; line-height:1.15; letter-spacing:0; white-space:pre; }
</style></head><body>
  <h2>Before — thin single-column candles (too small, PR #20 first pass)</h2>
  <div class="panel"><pre>${before}</pre></div>
  <h2>After — bigger chart: wide candle bodies, centred wicks, more height</h2>
  <div class="panel"><pre>${after}</pre></div>
</body></html>`;

const out = new URL('./chart-before-after.html', import.meta.url);
writeFileSync(out, html);
// eslint-disable-next-line no-console
console.log('wrote', out.pathname);
