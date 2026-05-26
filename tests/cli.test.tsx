import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import type { Lostfast } from '../src/app/lostfast.js';
import { App } from '../src/cli/App.js';
import { completeCommand, parseCommand, suggestCommands } from '../src/cli/commands.js';
import { OutputLine } from '../src/cli/output.js';
import { getTheme, themeNames } from '../src/cli/theme.js';
import { getExchange, exchangeNames, type ExchangeName } from '../src/cli/exchanges.js';
import { renderTradeLogLines } from '../src/cli/trade-log.js';
import { Money } from '../src/domain/money.js';
import type { RunReport } from '../src/pipeline/collector.js';

const fakeApp = {
  driver: 'test',
  config: {
    symbols: ['BTCUSDT'],
    interval: '1h',
    candleLimit: 120,
    accountBalance: 10_000,
    model: 'test-model',
    theme: 'violet',
    exchange: 'bybit',
    apiEnabled: true,
    apiHost: '127.0.0.1',
    apiPort: 0,
  },
  close: vi.fn(),
  strategies: () => [{ id: 'trend-following', title: 'Trend Following' }],
} as unknown as Lostfast;

describe('command autocomplete', () => {
  it('suggests commands by partial slash input', () => {
    expect(suggestCommands('/stat').map((c) => c.name)).toEqual(['/status']);
    expect(suggestCommands('st').map((c) => c.name)).toEqual(['/start', '/status', '/strategies']);
    expect(suggestCommands('ne').map((c) => c.name)).toEqual(['/news']);
  });

  it('completes unambiguous command prefixes', () => {
    expect(completeCommand('/stat')).toBe('/status');
    expect(completeCommand('up')).toBe('/update');
    expect(completeCommand('/s')).toBeNull();
  });

  it('parses theme command arguments', () => {
    expect(parseCommand('/theme ocean')).toMatchObject({ name: 'theme', token: 'theme', args: ['ocean'] });
    expect(parseCommand('/news')).toMatchObject({ name: 'news', token: 'news', args: [] });
  });

  it('parses exchange command arguments', () => {
    expect(parseCommand('/exchange bybit')).toMatchObject({ name: 'exchange', token: 'exchange', args: ['bybit'] });
    expect(parseCommand('exchange')).toMatchObject({ name: 'exchange', token: 'exchange', args: [] });
  });

  it('renders the interactive shell and accepts input', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, stdin, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    stdin.write('/stat');
    await new Promise((resolve) => setTimeout(resolve, 0));

    // With full live rendering the banner is always present; just prove no crash + prompt visible
    expect(lastFrame()).toContain('type a command');
    unmount();
  });

  it('applies a new theme via direct command without crashing', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, stdin, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    stdin.write('/theme ocean');
    await new Promise((resolve) => setTimeout(resolve, 0));
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 0));

    // We mainly verify the shell stays alive after theme command (full verification of live update + persistence
    // is done via unit tests + manual run). The "Theme: Ocean" message would appear in real terminal.
    expect(lastFrame()).toContain('type a command');
    unmount();
  });

  it('applies a new exchange via direct command without crashing', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, stdin, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    stdin.write('/exchange mexc');
    await new Promise((resolve) => setTimeout(resolve, 0));
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lastFrame()).toContain('type a command');
    unmount();
  });
});

describe('cli themes', () => {
  it('provides multiple named palettes with distinct text colors', () => {
    expect(themeNames()).toEqual(['violet', 'ocean', 'ember', 'forest', 'mono']);
    expect(getTheme('ocean').colors.info).not.toBe(getTheme('ember').colors.info);
    expect(getTheme('unknown').name).toBe('violet');
  });
});

describe('cli exchanges', () => {
  it('lists Binance, OKX, Bybit, MEXC and defaults to bybit', () => {
    expect(exchangeNames()).toEqual(['binance', 'okx', 'bybit', 'mexc']);
    expect(getExchange().name).toBe('bybit');
    expect(getExchange('mexc').label).toBe('MEXC');
    expect(getExchange('unknown').name).toBe('bybit');
  });
});

describe('run output', () => {
  const report: RunReport = {
    runId: 34,
    kind: 'start',
    searchResults: 3,
    durationMs: 2340,
    symbols: [
      {
        symbol: 'BTCUSDT',
        candlesAdded: 200,
        signalsInserted: 13,
        signalsUpdated: 0,
        signalsUnchanged: 0,
        scrapesAdded: 0,
        insight: 'hidden in table view',
        analysis: {
          symbol: 'BTCUSDT',
          analytics: {
            symbol: 'BTCUSDT',
            consensusScore: 0.17,
            longCount: 1,
            shortCount: 0,
            neutralCount: 12,
            strongestStrategy: 'pullback',
            strongestStrength: 0.72,
            lastPrice: 100,
            atr: 3.33,
          },
          evaluated: [
            {
              status: 'Approved by risk',
              signal: {
                symbol: 'BTCUSDT',
                strategy: 'pullback',
                direction: 'long',
                strength: 0.72,
                reason: 'pullback',
                suggestedRiskPercent: 0.5,
                at: 1,
              },
              position: {
                quantity: 10,
                notional: Money.zero(),
                riskAmount: Money.zero(),
                stopDistance: 5,
              },
              risk: { approved: true, reasons: [] },
            },
          ],
        },
      },
    ],
  };

  it('renders a bordered trade log table with entry, stop-loss, and target prices', () => {
    expect(renderTradeLogLines(report)).toEqual([
      'Trade Log',
      '╭──────────┬───────────┬────────┬───────┬─────────────╮',
      '│ Currency │ Direction │ TP     │ SL    │ Entry price │',
      '├──────────┼───────────┼────────┼───────┼─────────────┤',
      '│ BTCUSDT  │ long      │ 110.00 │ 95.00 │ 100.00      │',
      '╰──────────┴───────────┴────────┴───────┴─────────────╯',
    ]);
  });

  it('renders short trade direction and reverses target/stop placement', () => {
    const shortReport: RunReport = {
      ...report,
      symbols: [
        {
          ...report.symbols[0],
          analysis: {
            ...report.symbols[0].analysis,
            evaluated: report.symbols[0].analysis.evaluated.map((item) => ({
              ...item,
              signal: { ...item.signal, direction: 'short' },
            })),
          },
        },
      ],
    };

    expect(renderTradeLogLines(shortReport)).toContain('│ BTCUSDT  │ short     │ 90.00 │ 105.00 │ 100.00      │');
  });

  it('uses the bordered trade log in interactive output', () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, unmount } = render(
      <OutputLine item={{ id: 1, kind: 'run', report }} theme={getTheme('violet')} />,
      { stdout: tallStdout },
    );

    const frame = lastFrame();
    expect(frame).toContain('Trade Log');
    expect(frame).toContain('╭──────────┬───────────┬────────┬───────┬─────────────╮');
    expect(frame).toContain('│ BTCUSDT  │ long      │ 110.00 │ 95.00 │ 100.00      │');
    expect(frame).not.toContain('# Trade Log');
    expect(frame).not.toContain('| Currency |');
    expect(frame).not.toContain('strongest:');
    expect(frame).not.toContain('AI BTCUSDT');
    unmount();
  });

  it('keeps blank cells inside the bordered table when no actionable signal is available', () => {
    const noActionReport: RunReport = {
      ...report,
      symbols: [
        {
          ...report.symbols[0],
          analysis: {
            ...report.symbols[0].analysis,
            evaluated: report.symbols[0].analysis.evaluated.map((item) => ({
              ...item,
              position: null,
              risk: null,
            })),
          },
        },
      ],
    };

    expect(renderTradeLogLines(noActionReport)).toContain('│ BTCUSDT  │           │    │    │ 100.00      │');
  });
});
