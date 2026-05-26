import type { RunReport, SymbolReport } from '../pipeline/collector.js';

interface TradeLogRow {
  currency: string;
  direction: 'long' | 'short' | '';
  tp: number | null;
  sl: number | null;
  entryPrice: number | null;
}

export type TradeLogColumnKey = 'currency' | 'direction' | 'tp' | 'sl' | 'entryPrice';

const columns: { key: TradeLogColumnKey; label: string }[] = [
  { key: 'currency', label: 'Currency' },
  { key: 'direction', label: 'Direction' },
  { key: 'tp', label: 'TP' },
  { key: 'sl', label: 'SL' },
  { key: 'entryPrice', label: 'Entry price' },
];

export interface TradeLogCell {
  key: TradeLogColumnKey;
  text: string;
  value: string;
}

export type TradeLogRenderPart =
  | { kind: 'title'; text: string }
  | { kind: 'border'; text: string }
  | { kind: 'header' | 'row'; cells: TradeLogCell[] };

function isFinitePrice(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function buildTradeLogRow(symbol: SymbolReport): TradeLogRow {
  const entry = symbol.analysis.analytics.lastPrice;
  const candidates = symbol.analysis.evaluated
    .filter((item) => item.position && (item.signal.direction === 'long' || item.signal.direction === 'short'))
    .sort((a, b) => {
      const approvedDelta = Number(b.risk?.approved === true) - Number(a.risk?.approved === true);
      return approvedDelta !== 0 ? approvedDelta : b.signal.strength - a.signal.strength;
    });

  const selected = candidates[0];
  const direction =
    selected?.signal.direction === 'long' || selected?.signal.direction === 'short' ? selected.signal.direction : '';
  const stopDistance = selected?.position?.stopDistance;
  if (!isFinitePrice(entry) || !isFinitePrice(stopDistance)) {
    return {
      currency: symbol.symbol,
      direction,
      tp: null,
      sl: null,
      entryPrice: isFinitePrice(entry) ? entry : null,
    };
  }

  if (direction === 'short') {
    return {
      currency: symbol.symbol,
      direction,
      tp: entry - stopDistance * 2,
      sl: entry + stopDistance,
      entryPrice: entry,
    };
  }

  return {
    currency: symbol.symbol,
    direction,
    tp: entry + stopDistance * 2,
    sl: entry - stopDistance,
    entryPrice: entry,
  };
}

function formatPrice(value: number | null): string {
  return isFinitePrice(value) ? value.toFixed(2) : '';
}

function displayRows(report: RunReport): Record<TradeLogColumnKey, string>[] {
  const rows = report.symbols.map(buildTradeLogRow);
  const formatted = rows.map((row) => ({
    currency: row.currency,
    direction: row.direction,
    tp: formatPrice(row.tp),
    sl: formatPrice(row.sl),
    entryPrice: formatPrice(row.entryPrice),
  }));

  return formatted.length > 0
    ? formatted
    : [{ currency: '', direction: '', tp: '', sl: '', entryPrice: '' }];
}

function rowCells(
  row: Record<TradeLogColumnKey, string>,
  widths: Record<TradeLogColumnKey, number>,
): TradeLogCell[] {
  return columns.map(({ key }) => ({
    key,
    value: row[key],
    text: ` ${row[key].padEnd(widths[key])} `,
  }));
}

function borderLine(
  widths: Record<TradeLogColumnKey, number>,
  chars: { left: string; join: string; right: string },
): string {
  const segments = columns.map(({ key }) => '─'.repeat(widths[key] + 2));
  return `${chars.left}${segments.join(chars.join)}${chars.right}`;
}

function cellsLine(cells: readonly TradeLogCell[]): string {
  return `│${cells.map((cell) => cell.text).join('│')}│`;
}

/** Render structured table parts so Ink can color individual cells. */
export function renderTradeLogParts(report: RunReport): TradeLogRenderPart[] {
  const rows = displayRows(report);
  const widths = Object.fromEntries(
    columns.map(({ key, label }) => [key, Math.max(label.length, ...rows.map((row) => row[key].length))]),
  ) as Record<TradeLogColumnKey, number>;

  const header = rowCells(
    Object.fromEntries(columns.map(({ key, label }) => [key, label])) as Record<TradeLogColumnKey, string>,
    widths,
  );
  const top = borderLine(widths, { left: '╭', join: '┬', right: '╮' });
  const separator = borderLine(widths, { left: '├', join: '┼', right: '┤' });
  const bottom = borderLine(widths, { left: '╰', join: '┴', right: '╯' });

  return [
    { kind: 'title', text: 'Trade Log' },
    { kind: 'border', text: top },
    { kind: 'header', cells: header },
    { kind: 'border', text: separator },
    ...rows.map((row): TradeLogRenderPart => ({ kind: 'row', cells: rowCells(row, widths) })),
    { kind: 'border', text: bottom },
  ];
}

/** Render a terminal trade log table for interactive and headless output. */
export function renderTradeLogLines(report: RunReport): string[] {
  return renderTradeLogParts(report).map((part) => ('cells' in part ? cellsLine(part.cells) : part.text));
}
