/**
 * Renders a representative AI response with markdown-like markup and signed
 * value coloring, then writes docs/screenshots/ai-markup.png for PR review.
 *
 * Run with: npx tsx experiments/ai-markup-shot.ts
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { parseAiMarkup, type AiMarkupSegment } from '../src/cli/ai-markup.js';
import { getTheme, type CliTheme } from '../src/cli/theme.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'docs', 'screenshots', 'ai-markup.png');
const theme = getTheme('violet');

const sample = [
  'Актуальный курс **BYN/USD** на сегодня:',
  '',
  '- **1 BYN ≈ 0.3618–0.3623 USD**',
  '- **1 USD ≈ 2.76 BYN**',
  '',
  '`Динамика`: курс белорусского рубля немного укрепился (+0.24%).',
  'Сценарии: +890.05 при росте, -116 и -187.09 при снижении.',
  '',
  '```',
  'Источник: Rambler Finance, Kursbot, Investing.com.',
  '```',
].join('\n');

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function segmentStyle(segment: AiMarkupSegment, cliTheme: CliTheme): string {
  const styles: string[] = [];
  if (segment.bold) styles.push('font-weight:700');
  if (segment.code) styles.push(`color:${cliTheme.colors.info}`);
  if (segment.tone === 'positive') styles.push(`color:${cliTheme.colors.long}`);
  if (segment.tone === 'negative') styles.push(`color:${cliTheme.colors.short}`);
  return styles.length > 0 ? ` style="${styles.join(';')}"` : '';
}

const body = parseAiMarkup(sample)
  .map((segment) => `<span${segmentStyle(segment, theme)}>${esc(segment.text)}</span>`)
  .join('');

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  body{margin:0;background:#111318}
  .term{padding:22px 26px;background:#111318;color:#d1d5db;
    font-family:'DejaVu Sans Mono','Cascadia Code',Menlo,monospace;font-size:16px;line-height:1.48;white-space:pre-wrap;
    display:inline-block;min-width:920px}
  .accent{color:${theme.colors.accent};font-weight:700}
  .muted{color:#9ca3af}
</style></head><body><div class="term"><span class="accent">&gt; </span><span class="muted">Какой курс у byn/usd</span>

<span class="accent">▌AI</span>
${body}

<span class="accent">&gt; </span><span class="muted">type a command, e.g. /start  (/help for all)</span></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
const el = await page.$('.term');
await el!.screenshot({ path: outPath });
await browser.close();
process.stdout.write(`screenshot written: ${outPath}\n`);
