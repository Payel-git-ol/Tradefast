/**
 * Technical indicators.
 *
 * Indicator series operate on native `number` arrays (IEEE-754 doubles) which
 * is the standard for technical analysis and keeps evaluation fast. Statistical
 * primitives (mean, standard deviation) are taken from Math.js so the formulas
 * are exactly the textbook ones. Money and position sizing use the BigNumber
 * Math.js instance in `mathx.ts` where exactness is non-negotiable.
 *
 * `NaN` is used for "not enough data yet" slots so every returned series has the
 * same length as its input — callers read the last defined value.
 */
import { mean, std } from 'mathjs';
import type { Candle } from '../domain/candle.js';

const sliceMean = (values: readonly number[], end: number, period: number): number =>
  mean(values.slice(end - period + 1, end + 1)) as number;

/** Population standard deviation of a window (divisor N) — the classic Bollinger basis. */
const slicePopStd = (values: readonly number[], end: number, period: number): number =>
  std(values.slice(end - period + 1, end + 1), 'uncorrected') as unknown as number;

/** Simple Moving Average. */
export function sma(values: readonly number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    out[i] = sliceMean(values, i, period);
  }
  return out;
}

/**
 * Exponential Moving Average, seeded with the SMA of the first `period` values
 * (the conventional, drift-free seed rather than the first raw price).
 */
export function ema(values: readonly number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  out[period - 1] = sliceMean(values, period - 1, period);
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** Wilder's RMA (a.k.a. SMMA) — the smoothing behind RSI and the classic ATR. */
export function rma(values: readonly number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  out[period - 1] = sliceMean(values, period - 1, period);
  for (let i = period; i < values.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + values[i]) / period;
  }
  return out;
}

export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
}

/** Bollinger Bands using population standard deviation. */
export function bollingerBands(values: readonly number[], period = 20, k = 2): BollingerBands {
  const middle = sma(values, period);
  const upper = new Array<number>(values.length).fill(NaN);
  const lower = new Array<number>(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    const sd = slicePopStd(values, i, period);
    upper[i] = middle[i] + k * sd;
    lower[i] = middle[i] - k * sd;
  }
  return { upper, middle, lower };
}

/**
 * Relative Strength Index using Wilder's smoothing.
 * The first defined value is at index `period`.
 */
export function rsi(values: readonly number[], period = 14): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    gain += Math.max(change, 0);
    loss += Math.max(-change, 0);
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = !avgLoss || avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    out[i] = !avgLoss || avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** True Range series; index 0 is `NaN` because it needs the previous close. */
export function trueRange(candles: readonly Candle[]): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i];
    const prevClose = candles[i - 1].close;
    out[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  return out;
}

/** Average True Range using Wilder's smoothing (the canonical ATR). */
export function atr(candles: readonly Candle[], period = 14): number[] {
  const tr = trueRange(candles);
  // True range is undefined at index 0; smooth the values from index 1 onward.
  const smoothed = rma(tr.slice(1), period);
  const out = new Array<number>(candles.length).fill(NaN);
  for (let i = 0; i < smoothed.length; i++) out[i + 1] = smoothed[i];
  return out;
}

export interface Macd {
  macd: number[];
  signal: number[];
  histogram: number[];
}

/** Moving Average Convergence Divergence. */
export function macd(values: readonly number[], fast = 12, slow = 26, signalPeriod = 9): Macd {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) =>
    Number.isNaN(emaFast[i]) || Number.isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i],
  );
  // The signal line is an EMA over the defined part of the MACD line.
  const firstDefined = macdLine.findIndex((v) => !Number.isNaN(v));
  const signal = new Array<number>(values.length).fill(NaN);
  if (firstDefined !== -1) {
    const signalSlice = ema(macdLine.slice(firstDefined), signalPeriod);
    for (let i = 0; i < signalSlice.length; i++) signal[i + firstDefined] = signalSlice[i];
  }
  const histogram = values.map((_, i) =>
    Number.isNaN(macdLine[i]) || Number.isNaN(signal[i]) ? NaN : macdLine[i] - signal[i],
  );
  return { macd: macdLine, signal, histogram };
}

export interface Stochastic {
  k: number[];
  d: number[];
}

/** Stochastic oscillator (%K smoothed into %D with an SMA). */
export function stochastic(
  candles: readonly Candle[],
  period = 14,
  smoothD = 3,
): Stochastic {
  const k = new Array<number>(candles.length).fill(NaN);
  for (let i = period - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      highest = Math.max(highest, candles[j].high);
      lowest = Math.min(lowest, candles[j].low);
    }
    const range = highest - lowest;
    k[i] = range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100;
  }
  const d = sma(k.map((v) => (Number.isNaN(v) ? 0 : v)), smoothD).map((v, i) =>
    i < period - 1 + smoothD - 1 ? NaN : v,
  );
  return { k, d };
}

/**
 * Session VWAP: cumulative typical-price * volume divided by cumulative volume.
 * The whole supplied series is treated as one session.
 */
export function vwap(candles: readonly Candle[]): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < candles.length; i++) {
    const typical = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumPV += typical * candles[i].volume;
    cumV += candles[i].volume;
    out[i] = cumV === 0 ? typical : cumPV / cumV;
  }
  return out;
}

/**
 * Daily session VWAP that resets at each UTC day boundary.
 * Correct for intraday mean-reversion when the candle series spans multiple days.
 * Each bar uses VWAP accumulated from the start of its own UTC day.
 */
export function sessionVwap(candles: readonly Candle[]): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  let cumPV = 0;
  let cumV = 0;
  let currentDay = -1;

  for (let i = 0; i < candles.length; i++) {
    const day = Math.floor(candles[i].openTime / 86_400_000); // UTC day index
    if (day !== currentDay) {
      cumPV = 0;
      cumV = 0;
      currentDay = day;
    }
    const typical = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumPV += typical * candles[i].volume;
    cumV += candles[i].volume;
    out[i] = cumV === 0 ? typical : cumPV / cumV;
  }
  return out;
}

export interface DonchianChannel {
  upper: number[];
  lower: number[];
  middle: number[];
}

/** Donchian channel: rolling highest high / lowest low over `period`. */
export function donchian(candles: readonly Candle[], period = 20): DonchianChannel {
  const upper = new Array<number>(candles.length).fill(NaN);
  const lower = new Array<number>(candles.length).fill(NaN);
  const middle = new Array<number>(candles.length).fill(NaN);
  for (let i = period - 1; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    upper[i] = hh;
    lower[i] = ll;
    middle[i] = (hh + ll) / 2;
  }
  return { upper, lower, middle };
}

/**
 * Slope of the ordinary-least-squares line through `values` (x = 0,1,2,...).
 * A positive slope means the series is rising.
 */
export function linearRegressionSlope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = mean(values as number[]) as number;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** The last non-NaN value of a series, or `NaN` if there is none. */
export function lastDefined(series: readonly number[]): number {
  for (let i = series.length - 1; i >= 0; i--) {
    if (!Number.isNaN(series[i])) return series[i];
  }
  return NaN;
}
