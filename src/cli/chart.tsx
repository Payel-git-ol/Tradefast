import { Box, Text, useStdout } from 'ink';
import React from 'react';

import type { Candle } from '../domain/candle.js';
import type { CliTheme } from './theme.js';

export interface ChartData {
  symbol: string;
  interval: string;
  candles: readonly Candle[];
}

/** Format a price for the value axis with a sensible number of decimals. */
export function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return '–';
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  if (Math.abs(v) >= 0.01) return v.toFixed(4);
  if (Math.abs(v) >= 0.0001) return v.toFixed(6);
  return v.toFixed(8);
}

/** A single rendered chart cell: a glyph plus the candle direction it belongs to. */
export interface ChartCell {
  /** The character to draw. */
  ch: string;
  /** `true` bullish (close ≥ open), `false` bearish, `null` for empty/non-candle space. */
  up: boolean | null;
}

export interface ChartRow {
  /** Right-aligned price label, or blank spaces for unlabelled rows. */
  label: string;
  cells: ChartCell[];
}

export interface ChartLayout {
  rows: ChartRow[];
  footer: string;
  /** Candles actually drawn (after width clamping). */
  shown: number;
  /** Columns each candle body spans. */
  candleWidth: number;
  /** Empty columns between adjacent candles. */
  gap: number;
}

const GLYPH = {
  bodyFull: '█',
  bodyTop: '▀',
  bodyBottom: '▄',
  wickFull: '│',
  wickTop: '╵',
  wickBottom: '╷',
  empty: ' ',
} as const;

type Coverage = 'body' | 'wick' | 'empty';

/**
 * Build a deterministic candlestick layout. Each candle is `candleWidth` columns
 * wide (separated by `gap` blank columns) so the bodies read as solid bars like a
 * real trading chart; the body (open↔close) is filled with block glyphs and the
 * wick (high↔low) is a thin vertical line down the centre column. Two half-blocks
 * per character row double the vertical resolution so even small bodies and dojis
 * stay visible. Kept pure (no Ink/colour) so it can be unit-tested.
 */
export function buildChartLayout(
  candles: readonly Candle[],
  opts: { height?: number; maxCandles?: number; labelWidth?: number; candleWidth?: number; gap?: number } = {},
): ChartLayout {
  const height = Math.max(4, opts.height ?? 16);
  const candleWidth = Math.max(1, opts.candleWidth ?? 3);
  const gap = Math.max(0, opts.gap ?? 1);
  const maxCandles = Math.max(1, opts.maxCandles ?? 40);
  const labelWidth = Math.max(4, opts.labelWidth ?? 8);

  const visible = candles.slice(-maxCandles);
  if (visible.length === 0) {
    return { rows: [], footer: '', shown: 0, candleWidth, gap };
  }

  const highsArr = visible.map((c) => c.high);
  const lowsArr = visible.map((c) => c.low);
  const maxPrice = Math.max(...highsArr);
  const minPrice = Math.min(...lowsArr);
  const pad = maxPrice !== minPrice ? (maxPrice - minPrice) * 0.05 : Math.max(maxPrice * 0.01, 1e-8);
  const top = maxPrice + pad;
  const bottom = minPrice - pad;
  const range = top - bottom || 1;

  // Sub-cell grid: two half-cells per character row, indexed 0 (top) … H-1.
  const H = height * 2;
  // Price interval [lo, hi] covered by sub-cell k (0 = top).
  const subHi = (k: number): number => top - (k / H) * range;
  const subLo = (k: number): number => top - ((k + 1) / H) * range;

  // Classify a sub-cell for a candle by interval overlap (so a doji body is
  // never lost): body takes priority over the surrounding wick.
  const classify = (k: number, c: Candle): Coverage => {
    const hi = subHi(k);
    const lo = subLo(k);
    const bodyHi = Math.max(c.open, c.close);
    const bodyLo = Math.min(c.open, c.close);
    if (bodyLo <= hi && bodyHi >= lo) return 'body';
    if (c.low <= hi && c.high >= lo) return 'wick';
    return 'empty';
  };

  // The wick is only drawn down the body's centre column; the rest of a wick
  // sub-cell is blank so the candle reads as a thin stick above/below a wide body.
  const center = Math.floor(candleWidth / 2);
  const colCoverage = (cov: Coverage, isCenter: boolean): Coverage =>
    cov === 'wick' && !isCenter ? 'empty' : cov;

  const glyphFor = (tsv: Coverage, bsv: Coverage): string => {
    if (tsv === 'body' && bsv === 'body') return GLYPH.bodyFull;
    if (tsv === 'body') return GLYPH.bodyTop; // body occupies the top half
    if (bsv === 'body') return GLYPH.bodyBottom; // body occupies the bottom half
    if (tsv === 'wick' && bsv === 'wick') return GLYPH.wickFull;
    if (tsv === 'wick') return GLYPH.wickTop; // wick tip in the top half only
    if (bsv === 'wick') return GLYPH.wickBottom; // wick tip in the bottom half only
    return GLYPH.empty;
  };

  const rows: ChartRow[] = [];
  for (let row = 0; row < height; row++) {
    const topSub = row * 2;
    const botSub = row * 2 + 1;

    const cells: ChartCell[] = [];
    visible.forEach((c, ci) => {
      const up = c.close >= c.open;
      const tCov = classify(topSub, c);
      const bCov = classify(botSub, c);
      for (let col = 0; col < candleWidth; col++) {
        const isCenter = col === center;
        const ch = glyphFor(colCoverage(tCov, isCenter), colCoverage(bCov, isCenter));
        cells.push({ ch, up: ch === GLYPH.empty ? null : up });
      }
      // Blank columns separating this candle from the next one.
      if (ci < visible.length - 1) {
        for (let g = 0; g < gap; g++) cells.push({ ch: GLYPH.empty, up: null });
      }
    });

    // Label every other row to keep the price scale readable.
    const mid = top - ((row + 0.5) / height) * range;
    const label = row % 2 === 0 ? fmtPrice(mid).padStart(labelWidth) : ' '.repeat(labelWidth);
    rows.push({ label, cells });
  }

  const last = visible[visible.length - 1];
  const footer = `H ${fmtPrice(maxPrice).trim()} · L ${fmtPrice(minPrice).trim()} · last ${fmtPrice(last.close).trim()}`;

  return { rows, footer, shown: visible.length, candleWidth, gap };
}

/** Merge a row's cells into runs of the same direction so each run is one <Text>. */
function toSegments(cells: ChartCell[]): { text: string; up: boolean | null }[] {
  const segs: { text: string; up: boolean | null }[] = [];
  for (const cell of cells) {
    const last = segs[segs.length - 1];
    if (last && last.up === cell.up) last.text += cell.ch;
    else segs.push({ text: cell.ch, up: cell.up });
  }
  return segs;
}

export function CandleChartView({
  data,
  theme,
}: {
  data: ChartData;
  theme: CliTheme;
}): React.ReactElement {
  const { symbol, interval, candles } = data;
  const { stdout } = useStdout();
  if (candles.length === 0) return <></>;

  const labelWidth = 8;
  const candleWidth = 3;
  const gap = 1;

  // Size the chart to the terminal: keep candles wide and the body count clamped
  // so the chart never wraps. Account for the value-axis gutter, the rounded
  // border and horizontal padding.
  const columns = stdout?.columns ?? 80;
  const terminalRows = stdout?.rows ?? 24;
  const slot = candleWidth + gap; // columns consumed per candle (body + trailing gap)
  const plotWidth = Math.max(slot, columns - labelWidth - 1 - 4);
  const maxCandles = Math.max(8, Math.min(80, Math.floor((plotWidth + gap) / slot)));
  // A taller chart gives the candles room to breathe; clamp to the terminal.
  const height = Math.max(14, Math.min(24, terminalRows - 6));

  const { rows, footer, shown } = buildChartLayout(candles, {
    height,
    maxCandles,
    labelWidth,
    candleWidth,
    gap,
  });
  if (rows.length === 0) return <></>;

  const colorFor = (up: boolean | null): string | undefined =>
    up === null ? undefined : up ? theme.colors.long : theme.colors.short;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.border} paddingX={1} marginY={1}>
      <Text bold color={theme.colors.accent}>
        {symbol} · {interval} · last {shown} candles
      </Text>
      {rows.map((r, i) => (
        <Box key={i}>
          <Text color={theme.colors.muted}>{r.label} </Text>
          {toSegments(r.cells).map((seg, j) => (
            <Text key={j} color={colorFor(seg.up)}>
              {seg.text}
            </Text>
          ))}
        </Box>
      ))}
      <Text color={theme.colors.muted}>{' '.repeat(labelWidth + 1)}{footer}</Text>
    </Box>
  );
}
