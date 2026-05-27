/**
 * Renders the /operating-mode popup with full colour and writes a PNG to
 * docs/screenshots/. Reuses the ANSI->HTML converter from shot.mjs so the
 * output matches the other CLI screenshots.
 *
 * Run with: npx tsx experiments/operating-mode-shot.tsx
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import React from 'react';
import { render } from 'ink-testing-library';
import { chromium } from 'playwright';

import type { Lostfast } from '../src/app/lostfast.js';
import { App } from '../src/cli/App.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'docs', 'screenshots', 'cli-operating-mode.png');

const fakeApp = {
  driver: 'pglite',
  config: {
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    interval: '1h',
    candleLimit: 200,
    accountBalance: 10_000,
    model: 'claude-opus-4-7',
    theme: 'violet',
    exchange: 'bybit',
    mode: 'medium-term',
    apiEnabled: false,
    apiHost: '127.0.0.1',
    apiPort: 0,
  },
  close: async () => {},
  setExchange: () => {},
  setInterval: () => {},
  setMode: () => {},
  strategies: () => [],
} as unknown as Lostfast;

// --- Minimal ANSI SGR -> HTML converter (ported from shot.mjs) -------------
const NAMED: Record<number, string> = {
  30: '#000', 31: '#e06c75', 32: '#98c379', 33: '#e5c07b', 34: '#61afef', 35: '#c678dd', 36: '#56b6c2', 37: '#dcdcdc',
  90: '#7f848e', 91: '#e06c75', 92: '#98c379', 93: '#e5c07b', 94: '#61afef', 95: '#c678dd', 96: '#56b6c2', 97: '#fff',
};
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function convert(text: string): string {
  let fg: string | null = null, bold = false, dim = false, out = '', open = false;
  const span = (): void => {
    if (open) out += '</span>';
    const st: string[] = [];
    if (fg) st.push('color:' + fg);
    if (bold) st.push('font-weight:700');
    if (dim) st.push('opacity:.65');
    out += '<span style="' + st.join(';') + '">';
    open = true;
  };
  span();
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0, m: RegExpExecArray | null;
  const flush = (end: number): void => { out += esc(text.slice(last, end)); };
  while ((m = re.exec(text))) {
    flush(m.index);
    last = re.lastIndex;
    const parts = m[1].split(';').map(Number);
    for (let i = 0; i < parts.length; i++) {
      const c = parts[i];
      if (c === 0) { fg = null; bold = false; dim = false; }
      else if (c === 1) bold = true;
      else if (c === 2) dim = true;
      else if (c === 22) { bold = false; dim = false; }
      else if (c === 39) fg = null;
      else if (c === 38 && parts[i + 1] === 2) { fg = `rgb(${parts[i + 2]},${parts[i + 3]},${parts[i + 4]})`; i += 4; }
      else if (c === 38 && parts[i + 1] === 5) { i += 2; }
      else if (NAMED[c]) fg = NAMED[c];
    }
    span();
  }
  flush(text.length);
  if (open) out += '</span>';
  return out;
}

async function main(): Promise<void> {
  const tallStdout = { rows: 80, columns: 102, write: () => {}, on: () => {}, removeListener: () => {} } as any;
  const { lastFrame, stdin, unmount } = render(<App app={fakeApp} version="0.3.0" />, { stdout: tallStdout });

  await new Promise((r) => setTimeout(r, 10));
  for (const ch of '/operating-mode') {
    stdin.write(ch);
    await new Promise((r) => setTimeout(r, 2));
  }
  stdin.write('\r'); // fill suggestion
  await new Promise((r) => setTimeout(r, 5));
  stdin.write('\r'); // submit -> open popup
  await new Promise((r) => setTimeout(r, 20));

  const ansi = lastFrame() ?? '';
  unmount();

  const html = `<!doctype html><html><head><meta charset="utf8"><style>
    body{margin:0;background:#0d1117}
    .term{padding:24px 28px;background:#0d1117;color:#dcdcdc;
      font-family:'DejaVu Sans Mono','Cascadia Code',Menlo,monospace;font-size:15px;line-height:1.32;white-space:pre;
      display:inline-block}
  </style></head><body><div class="term">${convert(ansi)}</div></body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  const el = await page.$('.term');
  await el!.screenshot({ path: outPath });
  await browser.close();
  process.stdout.write(`screenshot written: ${outPath}\n`);
}

void main();
