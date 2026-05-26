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
 * Build a deterministic candlestick layout. Each candle is one column wide; the
 * body (open↔close) is drawn with block glyphs and the wick (high↔low) with a
 * thin vertical line, doubling the vertical resolution with half-blocks so even
 * small bodies stay visible. Kept pure (no Ink/colour) so it can be unit-tested.
 */
export function buildChartLayout(
  candles: readonly Candle[],
  opts: { height?: number; maxCandles?: number; labelWidth?: number } = {},
): ChartLayout {
  const height = Math.max(4, opts.height ?? 12);
  const maxCandles = Math.max(1, opts.maxCandles ?? 50);
  const labelWidth = Math.max(4, opts.labelWidth ?? 8);

  const visible = candles.slice(-maxCandles);
  if (visible.length === 0) {
    return { rows: [], footer: '', shown: 0 };
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

    const cells: ChartCell[] = visible.map((c) => {
      const tsv = classify(topSub, c);
      const bsv = classify(botSub, c);
      const ch = glyphFor(tsv, bsv);
      const up: boolean | null = ch === GLYPH.empty ? null : c.close >= c.open;
      return { ch, up };
    });

    // Label every other row to keep the price scale readable.
    const mid = top - ((row + 0.5) / height) * range;
    const label = row % 2 === 0 ? fmtPrice(mid).padStart(labelWidth) : ' '.repeat(labelWidth);
    rows.push({ label, cells });
  }

  const last = visible[visible.length - 1];
  const footer = `H ${fmtPrice(maxPrice).trim()} · L ${fmtPrice(minPrice).trim()} · last ${fmtPrice(last.close).trim()}`;

  return { rows, footer, shown: visible.length };
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
  // Keep the chart within the terminal width so candles never wrap. Account for
  // the value-axis gutter, the rounded border and horizontal padding.
  const columns = stdout?.columns ?? 80;
  const maxCandles = Math.max(10, Math.min(60, columns - labelWidth - 6));

  const { rows, footer, shown } = buildChartLayout(candles, { height: 12, maxCandles, labelWidth });
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
          {r.cells.map((cell, j) => (
            <Text key={j} color={colorFor(cell.up)}>
              {cell.ch}
            </Text>
          ))}
        </Box>
      ))}
      <Text color={theme.colors.muted}>{' '.repeat(labelWidth + 1)}{footer}</Text>
    </Box>
  );
}
