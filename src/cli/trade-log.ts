import type { RunReport, SymbolReport } from '../pipeline/collector.js';

interface TradeLogRow {
  currency: string;
  tp: number | null;
  sl: number | null;
  entryPrice: number | null;
}

type ColumnKey = 'currency' | 'tp' | 'sl' | 'entryPrice';

const columns: { key: ColumnKey; label: string }[] = [
  { key: 'currency', label: 'Currency' },
  { key: 'tp', label: 'TP' },
  { key: 'sl', label: 'SL' },
  { key: 'entryPrice', label: 'Entry price' },
];

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
  const stopDistance = selected?.position?.stopDistance;
  if (!isFinitePrice(entry) || !isFinitePrice(stopDistance)) {
    return { currency: symbol.symbol, tp: null, sl: null, entryPrice: isFinitePrice(entry) ? entry : null };
  }

  if (selected.signal.direction === 'short') {
    return {
      currency: symbol.symbol,
      tp: entry - stopDistance * 2,
      sl: entry + stopDistance,
      entryPrice: entry,
    };
  }

  return {
    currency: symbol.symbol,
    tp: entry + stopDistance * 2,
    sl: entry - stopDistance,
    entryPrice: entry,
  };
}

function formatPrice(value: number | null): string {
  return isFinitePrice(value) ? value.toFixed(2) : '';
}

function displayRows(report: RunReport): Record<ColumnKey, string>[] {
  const rows = report.symbols.map(buildTradeLogRow);
  const formatted = rows.map((row) => ({
    currency: row.currency,
    tp: formatPrice(row.tp),
    sl: formatPrice(row.sl),
    entryPrice: formatPrice(row.entryPrice),
  }));

  return formatted.length > 0
    ? formatted
    : [{ currency: '', tp: '', sl: '', entryPrice: '' }];
}

function rowLine(row: Record<ColumnKey, string>, widths: Record<ColumnKey, number>): string {
  return `| ${columns.map(({ key }) => row[key].padEnd(widths[key])).join(' | ')} |`;
}

/** Render a markdown-style trade log table for terminal and headless output. */
export function renderTradeLogLines(report: RunReport): string[] {
  const rows = displayRows(report);
  const widths = Object.fromEntries(
    columns.map(({ key, label }) => [key, Math.max(label.length, ...rows.map((row) => row[key].length))]),
  ) as Record<ColumnKey, number>;

  const header = rowLine(
    Object.fromEntries(columns.map(({ key, label }) => [key, label])) as Record<ColumnKey, string>,
    widths,
  );
  const separator = `|${columns.map(({ key }) => '-'.repeat(widths[key] + 2)).join('|')}|`;

  return ['# Trade Log', '', header, separator, ...rows.map((row) => rowLine(row, widths))];
}
