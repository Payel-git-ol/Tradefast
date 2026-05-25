import gradient from 'gradient-string';

/**
 * The Lostfast palette. A cool indigo→violet→magenta gradient drives the banner,
 * echoing the look of modern terminal UIs while staying distinct.
 */
export const BRAND_COLORS = ['#4f46e5', '#7c3aed', '#9333ea', '#db2777'];

export const brandGradient = gradient(BRAND_COLORS);

/** Semantic colours used across the UI (Ink color names / hex). */
export const COLORS = {
  accent: '#9333ea',
  long: 'green',
  short: 'red',
  neutral: 'gray',
  muted: 'gray',
  info: 'cyan',
  warn: 'yellow',
  error: 'red',
} as const;

/** Colour for a directional bias. */
export const directionColor = (direction: string): string =>
  direction === 'long' ? COLORS.long : direction === 'short' ? COLORS.short : COLORS.neutral;
