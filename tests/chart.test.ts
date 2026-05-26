import { describe, expect, it } from 'vitest';

import { buildChartLayout, fmtPrice } from '../src/cli/chart.js';
import type { Candle } from '../src/domain/candle.js';

const BODY = new Set(['█', '▀', '▄']);
const WICK = new Set(['│', '╵', '╷']);

function candle(partial: Partial<Candle> & { open: number; close: number }): Candle {
  const { open, close } = partial;
  return {
    openTime: partial.openTime ?? 0,
    open,
    close,
    high: partial.high ?? Math.max(open, close),
    low: partial.low ?? Math.min(open, close),
    volume: partial.volume ?? 1,
  };
}

type Opts = { height?: number; maxCandles?: number; labelWidth?: number; candleWidth?: number; gap?: number };

/** All glyphs of candle `index`'s columns, row by row, top → bottom. */
function candleColumns(candles: Candle[], index: number, opts: Opts = {}): { ch: string; up: boolean | null }[][] {
  const layout = buildChartLayout(candles, { maxCandles: candles.length, ...opts });
  const { candleWidth, gap } = layout;
  const start = index * (candleWidth + gap);
  return layout.rows.map((r) => r.cells.slice(start, start + candleWidth));
}

/** The centre column of candle `index` (where the wick lives), top → bottom. */
function centerColumn(candles: Candle[], index = 0, opts: Opts = {}): { ch: string; up: boolean | null }[] {
  const layout = buildChartLayout(candles, { maxCandles: candles.length, ...opts });
  const { candleWidth, gap } = layout;
  const center = index * (candleWidth + gap) + Math.floor(candleWidth / 2);
  return layout.rows.map((r) => r.cells[center]);
}

describe('fmtPrice', () => {
  it('scales decimals to the magnitude of the value', () => {
    expect(fmtPrice(78029)).toBe('78029');
    expect(fmtPrice(12.345)).toBe('12.35');
    expect(fmtPrice(0.04231)).toBe('0.0423');
    expect(fmtPrice(0.00012345)).toBe('0.000123');
    expect(fmtPrice(NaN)).toBe('–');
  });
});

describe('buildChartLayout', () => {
  it('returns nothing for an empty series', () => {
    expect(buildChartLayout([])).toMatchObject({ rows: [], footer: '', shown: 0 });
  });

  it('draws wicks above and below the body of a candle', () => {
    const col = centerColumn([candle({ open: 100, close: 110, high: 120, low: 90 })], 0, { height: 12 });
    const glyphs = col.map((c) => c.ch);

    const drawn = col.filter((c) => c.ch !== ' ');
    expect(drawn.length).toBeGreaterThan(0);
    // Some body and some wick must be present.
    expect(glyphs.some((g) => BODY.has(g))).toBe(true);
    expect(glyphs.some((g) => WICK.has(g))).toBe(true);

    // The extremes of the candle are the wick tips (high/low extend past the body).
    expect(WICK.has(drawn[0].ch)).toBe(true);
    expect(WICK.has(drawn[drawn.length - 1].ch)).toBe(true);

    // The body sits strictly between the wick tips.
    const firstBody = glyphs.findIndex((g) => BODY.has(g));
    const lastBody = glyphs.length - 1 - [...glyphs].reverse().findIndex((g) => BODY.has(g));
    const firstDrawn = glyphs.findIndex((g) => g !== ' ');
    const lastDrawn = glyphs.length - 1 - [...glyphs].reverse().findIndex((g) => g !== ' ');
    expect(firstBody).toBeGreaterThan(firstDrawn);
    expect(lastBody).toBeLessThan(lastDrawn);
  });

  it('draws a body several columns wide with the wick down the centre only', () => {
    const cols = candleColumns([candle({ open: 100, close: 110, high: 120, low: 90 })], 0, {
      height: 12,
      candleWidth: 3,
      gap: 1,
    });
    // A body row: every column is a block glyph.
    const bodyRow = cols.find((row) => row.every((c) => BODY.has(c.ch)));
    expect(bodyRow).toBeDefined();
    expect(bodyRow).toHaveLength(3);

    // A wick row: only the centre column is drawn, the flanks are blank.
    const wickRow = cols.find((row) => WICK.has(row[1].ch));
    expect(wickRow).toBeDefined();
    expect(wickRow![0].ch).toBe(' ');
    expect(wickRow![2].ch).toBe(' ');
  });

  it('separates adjacent candles with a blank gap column', () => {
    const candles = [
      candle({ open: 100, close: 110, high: 115, low: 95 }),
      candle({ open: 110, close: 120, high: 125, low: 105 }),
    ];
    const layout = buildChartLayout(candles, { maxCandles: 2, candleWidth: 3, gap: 1 });
    // Column index 3 is the gap between candle 0 (cols 0-2) and candle 1 (cols 4-6).
    expect(layout.rows.every((r) => r.cells[3].ch === ' ')).toBe(true);
    // No trailing gap after the final candle.
    expect(layout.rows[0].cells).toHaveLength(2 * 3 + 1);
  });

  it('colours bullish candles long and bearish candles short', () => {
    const up = candleColumns([candle({ open: 100, close: 110, high: 115, low: 95 })], 0).flat();
    const down = candleColumns([candle({ open: 110, close: 100, high: 115, low: 95 })], 0).flat();
    expect(up.filter((c) => c.up !== null).every((c) => c.up === true)).toBe(true);
    expect(down.filter((c) => c.up !== null).every((c) => c.up === false)).toBe(true);
  });

  it('keeps a doji body visible even when open equals close', () => {
    const cols = candleColumns([candle({ open: 100, close: 100, high: 108, low: 92 })], 0, { height: 12 });
    expect(cols.flat().some((c) => BODY.has(c.ch))).toBe(true);
  });

  it('never crashes on a perfectly flat series', () => {
    const flat = Array.from({ length: 5 }, (_, i) => candle({ openTime: i, open: 50, close: 50 }));
    const { rows, shown } = buildChartLayout(flat, { height: 8 });
    expect(shown).toBe(5);
    expect(rows).toHaveLength(8);
    expect(rows.some((r) => r.cells.some((c) => c.ch !== ' '))).toBe(true);
  });

  it('clamps the number of candles drawn to maxCandles (keeping the most recent)', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      candle({ openTime: i, open: 100 + i, close: 101 + i, high: 102 + i, low: 99 + i }),
    );
    const layout = buildChartLayout(many, { maxCandles: 30, candleWidth: 3, gap: 1 });
    expect(layout.shown).toBe(30);
    // 30 candles × 3 columns + 29 single-column gaps.
    expect(layout.rows[0].cells).toHaveLength(30 * 3 + 29);
    // Footer reflects the most recent (highest) close.
    expect(layout.footer).toContain('last 180.00');
  });

  it('labels every other row and pads unlabelled rows to the same width', () => {
    const { rows } = buildChartLayout([candle({ open: 100, close: 110, high: 120, low: 90 })], {
      height: 8,
      labelWidth: 8,
    });
    expect(rows[0].label.trim()).not.toBe('');
    expect(rows[1].label.trim()).toBe('');
    expect(rows.every((r) => r.label.length === 8)).toBe(true);
  });
});
