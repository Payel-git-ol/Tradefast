import type { IntervalName } from './intervals.js';

/**
 * A high-level trading style. Where `/operating-mode-time` chooses an exact
 * timeframe, an operating mode answers the broader question of *how long the
 * trader wants to stay in the market* and applies a sensible timeframe for that
 * horizon. Selecting a mode keeps the platform from being locked to a single
 * (previously medium-term) horizon.
 */
export interface ModeInfo {
  name: string;
  label: string;
  description: string;
  /** The candle timeframe this mode analyses on. */
  interval: IntervalName;
}

const MODES = {
  'long-term': {
    name: 'long-term',
    label: 'Long-term',
    description: 'Position trading on daily candles — fewer, higher-conviction signals',
    interval: '1d',
  },
  'medium-term': {
    name: 'medium-term',
    label: 'Medium-term',
    description: 'Swing trading on hourly candles — the balanced default',
    interval: '1h',
  },
  scalping: {
    name: 'scalping',
    label: 'Scalping',
    description: 'Short-term trading on 5m candles — frequent, fast signals',
    interval: '5m',
  },
} satisfies Record<string, ModeInfo>;

export type ModeName = keyof typeof MODES;

export const DEFAULT_MODE: ModeName = 'medium-term';

export const modeNames = (): ModeName[] => Object.keys(MODES) as ModeName[];

export function getMode(name?: string): ModeInfo {
  const normalized = (name ?? DEFAULT_MODE).toLowerCase();
  return MODES[normalized as ModeName] ?? MODES[DEFAULT_MODE];
}
