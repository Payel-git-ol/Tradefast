import type { RunReport, SymbolReport } from '../pipeline/collector.js';
import { buildForecast } from '../strategies/forecast.js';

interface TradeLogRow {
  currency: string;
  direction: 'long' | 'short' | '';
  tp: number | null;
  sl: number | null;
  entryPrice: number | null;
  assessment: string;
}

export type TradeLogColumnKey = 'currency' | 'direction' | 'tp' | 'sl' | 'entryPrice' | 'assessment';

const columns: { key: TradeLogColumnKey; label: string }[] = [
  { key: 'currency', label: 'Currency' },
  { key: 'direction', label: 'Dir' },
  { key: 'tp', label: 'TP' },
  { key: 'sl', label: 'SL' },
  { key: 'entryPrice', label: 'Price' },
  { key: 'assessment', label: 'AI' },
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

/** Map the shared forecast (single source of truth) onto a trade-log row. */
function buildTradeLogRow(symbol: SymbolReport): TradeLogRow {
  const forecast = buildForecast(symbol.analysis);
  return {
    currency: forecast.symbol,
    direction: forecast.direction,
    tp: forecast.tp,
    sl: forecast.sl,
    entryPrice: forecast.entry,
    assessment: symbol.assessment,
  };
}

function formatPrice(value: number | null): string {
  if (!isFinitePrice(value)) return '';
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  if (value >= 0.0001) return value.toFixed(6);
  if (value >= 0.000001) return value.toFixed(8);
  return value.toFixed(12);
}

const MAX_ASSESSMENT_WIDTH = 50;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function displayRows(report: RunReport): Record<TradeLogColumnKey, string>[] {
  const rows = report.symbols.map(buildTradeLogRow);
  const formatted = rows.map((row) => ({
    currency: row.currency,
    direction: row.direction,
    tp: formatPrice(row.tp),
    sl: formatPrice(row.sl),
    entryPrice: formatPrice(row.entryPrice),
    assessment: truncate(row.assessment, MAX_ASSESSMENT_WIDTH),
  }));

  return formatted.length > 0
    ? formatted
    : [{ currency: '', direction: '', tp: '', sl: '', entryPrice: '', assessment: '' }];
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
