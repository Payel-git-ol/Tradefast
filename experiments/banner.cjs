const figlet = require('figlet');
const glyph = (ch) => figlet.textSync(ch, { font: 'ANSI Shadow' }).split('\n');

// Custom Ø: the O glyph with a clean diagonal stroke (lower-left → upper-right).
const OSlash = [
  ' ██████╗ ',
  '██╔══███╗',
  '██║ █ ██║',
  '██║█  ██║',
  '╚██████╔╝',
  ' ╚═════╝ ',
  '         ',
];

// Custom Λ (lambda): pointed apex with legs spreading outward.
const Lambda = [
  '  ██╗   ',
  ' ████╗  ',
  '██╔██╗  ',
  '██╝╚██╗ ',
  '██╗ ╚██╗',
  '╚═╝  ╚═╝',
  '        ',
];

const letters = ['L', OSlash, 'S', 'T', 'F', Lambda, 'S', 'T'];
const rows = 7;
const lines = Array.from({ length: rows }, () => '');
for (const l of letters) {
  const g = Array.isArray(l) ? l : glyph(l);
  for (let r = 0; r < rows; r++) lines[r] += (g[r] ?? '').padEnd((g[0]||'').length, ' ');
}
console.log(lines.join('\n').replace(/\s+$/gm,''));
