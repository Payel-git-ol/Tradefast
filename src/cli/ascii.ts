import figlet from 'figlet';

/**
 * Custom Ø glyph: the ANSI-Shadow "O" with a clean diagonal stroke
 * (lower-left → upper-right). figlet has no glyph for Ø, so we supply one that
 * matches the font's weight and shadow convention.
 */
const O_SLASH = [
  ' ██████╗ ',
  '██╔══███╗',
  '██║ █ ██║',
  '██║█  ██║',
  '╚██████╔╝',
  ' ╚═════╝ ',
  '         ',
];

/** Custom Λ glyph: a pointed apex with legs spreading outward, matching the font. */
const LAMBDA = [
  '  ██╗   ',
  ' ████╗  ',
  '██╔██╗  ',
  '██╝╚██╗ ',
  '██╗ ╚██╗',
  '╚═╝  ╚═╝',
  '        ',
];

const BANNER_ROWS = 7;
type Glyph = string | string[];
/** L Ø S T F Λ S T — the two stylised letters use the custom glyphs above. */
const WORDMARK: Glyph[] = ['L', O_SLASH, 'S', 'T', 'F', LAMBDA, 'S', 'T'];

const glyphLines = (g: Glyph): string[] =>
  Array.isArray(g) ? g : figlet.textSync(g, { font: 'ANSI Shadow' }).split('\n');

/**
 * Builds the multi-line "LØSTFΛST" block banner by laying every glyph side by
 * side, preserving each glyph's native width. Returns the raw (uncoloured) art;
 * the gradient is applied by the renderer.
 */
export function renderBannerArt(): string {
  const lines = Array.from({ length: BANNER_ROWS }, () => '');
  for (const glyph of WORDMARK) {
    const g = glyphLines(glyph);
    const width = g[0]?.length ?? 0;
    for (let r = 0; r < BANNER_ROWS; r++) {
      lines[r] += (g[r] ?? '').padEnd(width, ' ');
    }
  }
  // Drop fully-blank trailing rows and right-trim each line.
  return lines
    .map((l) => l.replace(/\s+$/u, ''))
    .filter((l, i, arr) => l.length > 0 || i < arr.length - 1)
    .join('\n');
}
