import gradient from 'gradient-string';

export interface ThemeColors {
  accent: string;
  border: string;
  text: string;
  muted: string;
  info: string;
  warn: string;
  error: string;
  long: string;
  short: string;
  neutral: string;
}

export interface CliTheme {
  name: string;
  label: string;
  brandColors: string[];
  colors: ThemeColors;
}

const THEMES = {
  violet: {
    name: 'violet',
    label: 'Violet',
    brandColors: ['#4f46e5', '#7c3aed', '#9333ea', '#db2777'],
    colors: {
      accent: '#9333ea',
      border: '#a855f7',
      text: '#f5f3ff',
      muted: 'gray',
      info: 'cyan',
      warn: 'yellow',
      error: 'red',
      long: 'green',
      short: 'red',
      neutral: 'gray',
    },
  },
  ocean: {
    name: 'ocean',
    label: 'Ocean',
    brandColors: ['#0891b2', '#0ea5e9', '#22c55e'],
    colors: {
      accent: '#0ea5e9',
      border: '#06b6d4',
      text: '#e0f2fe',
      muted: '#94a3b8',
      info: '#22d3ee',
      warn: '#facc15',
      error: '#fb7185',
      long: '#22c55e',
      short: '#fb7185',
      neutral: '#94a3b8',
    },
  },
  ember: {
    name: 'ember',
    label: 'Ember',
    brandColors: ['#dc2626', '#f97316', '#facc15'],
    colors: {
      accent: '#f97316',
      border: '#fb923c',
      text: '#fff7ed',
      muted: '#a1a1aa',
      info: '#facc15',
      warn: '#fde047',
      error: '#ef4444',
      long: '#84cc16',
      short: '#ef4444',
      neutral: '#a1a1aa',
    },
  },
  forest: {
    name: 'forest',
    label: 'Forest',
    brandColors: ['#16a34a', '#14b8a6', '#84cc16'],
    colors: {
      accent: '#22c55e',
      border: '#10b981',
      text: '#ecfdf5',
      muted: '#9ca3af',
      info: '#2dd4bf',
      warn: '#fbbf24',
      error: '#f87171',
      long: '#86efac',
      short: '#f87171',
      neutral: '#9ca3af',
    },
  },
  mono: {
    name: 'mono',
    label: 'Mono',
    brandColors: ['#e5e7eb', '#9ca3af', '#f9fafb'],
    colors: {
      accent: '#e5e7eb',
      border: '#9ca3af',
      text: '#f9fafb',
      muted: '#9ca3af',
      info: '#d1d5db',
      warn: '#facc15',
      error: '#f87171',
      long: '#86efac',
      short: '#f87171',
      neutral: '#9ca3af',
    },
  },
} satisfies Record<string, CliTheme>;

export type ThemeName = keyof typeof THEMES;

export const DEFAULT_THEME = THEMES.violet;

export const COLORS = DEFAULT_THEME.colors;

export const brandGradient = gradient(DEFAULT_THEME.brandColors);

export const themeNames = (): ThemeName[] => Object.keys(THEMES) as ThemeName[];

export function getTheme(name?: string): CliTheme {
  const normalized = (name ?? DEFAULT_THEME.name).toLowerCase();
  return THEMES[normalized as ThemeName] ?? DEFAULT_THEME;
}

export function themeGradient(theme: CliTheme = DEFAULT_THEME): (text: string) => string {
  return gradient(theme.brandColors);
}

/** Colour for a directional bias. */
export const directionColor = (direction: string, theme: CliTheme = DEFAULT_THEME): string =>
  direction === 'long' ? theme.colors.long : direction === 'short' ? theme.colors.short : theme.colors.neutral;
