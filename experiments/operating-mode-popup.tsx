/**
 * Renders the /operating-mode popup the way the interactive shell does and
 * prints the resulting terminal frame. Run with: npx tsx experiments/operating-mode-popup.tsx
 */
import React from 'react';
import { render } from 'ink-testing-library';

import type { Lostfast } from '../src/app/lostfast.js';
import { App } from '../src/cli/App.js';

const fakeApp = {
  driver: 'test',
  config: {
    symbols: ['BTCUSDT'],
    interval: '1h',
    candleLimit: 120,
    accountBalance: 10_000,
    model: 'demo',
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

async function main(): Promise<void> {
  const tallStdout = { rows: 80, columns: 110, write: () => {}, on: () => {}, removeListener: () => {} } as any;
  const { lastFrame, stdin, unmount } = render(<App app={fakeApp} version="0.3.0" />, { stdout: tallStdout });

  await new Promise((r) => setTimeout(r, 10));
  for (const ch of '/operating-mode') {
    stdin.write(ch);
    await new Promise((r) => setTimeout(r, 2));
  }
  stdin.write('\r'); // fill the suggestion
  await new Promise((r) => setTimeout(r, 5));
  stdin.write('\r'); // submit -> open popup
  await new Promise((r) => setTimeout(r, 20));

  process.stdout.write(`${lastFrame()}\n`);
  unmount();
}

void main();
