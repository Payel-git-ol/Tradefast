// Renders the CLI, runs /help then /clear-chat, and prints the resulting
// terminal frame to demonstrate that /clear-chat restores the welcome banner
// + tips (issue #25) instead of blanking the screen.
import React from 'react';
import { render } from 'ink-testing-library';

import type { Tradefast } from '../src/app/tradefast.js';
import { App } from '../src/cli/App.js';

const fakeApp = {
  driver: 'pglite',
  config: {
    symbols: ['BTCUSDT'],
    interval: '1h',
    candleLimit: 120,
    accountBalance: 10_000,
    model: 'claude-4.7-opus',
    theme: 'lime',
    exchange: 'bybit',
    mode: 'medium-term',
    apiEnabled: true,
    apiHost: '127.0.0.1',
    apiPort: 0,
  },
  close: () => {},
  strategies: () => [],
} as unknown as Tradefast;

const tallStdout = { rows: 80, columns: 100, write: () => {}, on: () => {}, removeListener: () => {} } as any;
const { lastFrame, stdin } = render(
  <App app={fakeApp} version="0.4.1" apiUrl="http://127.0.0.1:60576/graphql" />,
  { stdout: tallStdout },
);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const submit = async (cmd: string) => {
  for (const ch of cmd) { stdin.write(ch); await wait(2); }
  stdin.write('\r'); await wait(8); stdin.write('\r'); await wait(25);
};

await wait(15);
await submit('/help');
console.log('===== BEFORE /clear-chat (transcript full of output) =====');
console.log(lastFrame());
await submit('/clear-chat');
console.log('\n===== AFTER /clear-chat (welcome banner restored) =====');
console.log(lastFrame());
process.exit(0);
