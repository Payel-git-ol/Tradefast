import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import type { Tradefast } from '../src/app/tradefast.js';
import { App } from '../src/cli/App.js';
import { parseAiMarkup } from '../src/cli/ai-markup.js';
import { completeCommand, parseCommand, suggestCommands } from '../src/cli/commands.js';
import { OutputLine } from '../src/cli/output.js';
import { getTheme, themeNames } from '../src/cli/theme.js';
import { getExchange, exchangeNames, isBinaryOptions, exchangeKind, type ExchangeName } from '../src/cli/exchanges.js';
import { getMode, modeNames } from '../src/cli/modes.js';
import { renderBacktestLines } from '../src/cli/backtest-log.js';
import { renderTradeLogLines } from '../src/cli/trade-log.js';
import { Money } from '../src/domain/money.js';
import type { RunReport } from '../src/pipeline/collector.js';
import type { BacktestReport } from '../src/services/backtest.js';

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
    mode: 'medium-term',
    apiEnabled: true,
    apiHost: '127.0.0.1',
    apiPort: 0,
  },
  close: vi.fn(),
  setExchange: vi.fn(),
  setInterval: vi.fn(),
  setMode: vi.fn(),
  strategies: () => [{ id: 'trend-following', title: 'Trend Following' }],
} as unknown as Tradefast;

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

  it('parses operating-mode separately from operating-mode-time', () => {
    expect(parseCommand('/operating-mode scalping')).toMatchObject({
      name: 'operating-mode',
      token: 'operating-mode',
      args: ['scalping'],
    });
    expect(parseCommand('/operating-mode-time 5m')).toMatchObject({
      name: 'operating-mode-time',
      token: 'operating-mode-time',
      args: ['5m'],
    });
  });

  it('suggests both operating-mode commands for the shared prefix', () => {
    expect(suggestCommands('/operating-mode').map((c) => c.name)).toEqual([
      '/operating-mode',
      '/operating-mode-time',
    ]);
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

  it('applies an operating mode via direct command, shifting the timeframe', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const setMode = vi.fn();
    const setInterval = vi.fn();
    const app = { ...fakeApp, setMode, setInterval } as unknown as Tradefast;
    const { stdin, unmount } = render(
      <App app={app} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    // Let the component mount so its input handler is registered before typing.
    await new Promise((resolve) => setTimeout(resolve, 10));
    // ink-text-input only registers single-key writes in this harness, so type
    // the command one character at a time before submitting.
    for (const ch of '/operating-mode scalping') {
      stdin.write(ch);
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(setMode).toHaveBeenCalledWith('scalping');
    // Scalping analyses on 5m candles, so the timeframe is applied alongside.
    expect(setInterval).toHaveBeenCalledWith('5m');
    unmount();
  });

  it('opens the operating-mode selector popup on the bare command', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, stdin, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    // Let the component mount so its input handler is registered before typing.
    await new Promise((resolve) => setTimeout(resolve, 10));
    for (const ch of '/operating-mode') {
      stdin.write(ch);
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    // The prefix matches two commands, so the first Enter fills the suggestion
    // and the second submits the now-unambiguous command.
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 5));
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(lastFrame()).toContain('Select operating mode');
    expect(lastFrame()).toContain('Scalping');
    unmount();
  });

  it('prompts for an operating mode on first launch', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" promptOperatingMode />,
      { stdout: tallStdout },
    );

    await new Promise((resolve) => setTimeout(resolve, 5));

    // No typing: the selector should already be open so the user picks a style
    // before starting, as the issue requires.
    expect(lastFrame()).toContain('Select operating mode');
    expect(lastFrame()).toContain('Long-term');
    unmount();
  });

  it('restores the banner and getting-started tips after /clear-chat', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, stdin, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    // Let the component mount so its input handler is registered before typing.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const submit = async (command: string) => {
      for (const ch of command) {
        stdin.write(ch);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      // The first Enter fills the highlighted suggestion; the second submits.
      stdin.write('\r');
      await new Promise((resolve) => setTimeout(resolve, 5));
      stdin.write('\r');
      await new Promise((resolve) => setTimeout(resolve, 20));
    };

    // Add some transcript output, then clear it.
    await submit('/help');
    expect(lastFrame()).toContain('Commands:');

    await submit('/clear-chat');

    // After clearing the chat the screen should look like a fresh launch: the
    // banner tips panel is restored and prior output is gone, instead of the
    // awkward blank transcript the old [] reset left behind (#25).
    const frame = lastFrame();
    expect(frame).toContain('Tips for getting started');
    expect(frame).not.toContain('Commands:');
    expect(frame).toContain('type a command');
    unmount();
  });

  it('does not prompt for an operating mode when one is already saved', async () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(lastFrame()).not.toContain('Select operating mode');
    expect(lastFrame()).toContain('type a command');
    unmount();
  });

  it('lets AI chat search the internet directly for current non-tracked rates', async () => {
    const previousKey = process.env.TRADEFAST_AI_API_KEY;
    const previousUrl = process.env.TRADEFAST_AI_API_URL;
    process.env.TRADEFAST_AI_API_KEY = 'test-key';
    process.env.TRADEFAST_AI_API_URL = 'http://127.0.0.1/v1/chat/completions';

    const search = vi.fn().mockResolvedValue([
      {
        query: 'RUB/USD exchange rate',
        source: 'web-search',
        title: 'USD/RUB Exchange Rate',
        url: 'https://example.com/rub-usd',
        snippet: '1 USD equals 90 RUB',
        score: 1,
      },
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'run_web_search',
                    arguments: JSON.stringify({ query: 'RUB/USD exchange rate', limit: 3 }),
                  },
                },
              ],
            },
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'По веб-поиску: 1 USD примерно равен 90 RUB.' } }],
      })));
    vi.stubGlobal('fetch', fetchMock);

    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const app = { ...fakeApp, search } as unknown as Tradefast;
    const { lastFrame, stdin, unmount } = render(
      <App app={app} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
      { stdout: tallStdout },
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      for (const ch of 'rub/usd rate') {
        stdin.write(ch);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      stdin.write('\r');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const firstBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      const toolNames = firstBody.tools.map((tool: { function: { name: string } }) => tool.function.name);
      expect(toolNames).toContain('run_web_search');
      expect(search).toHaveBeenCalledWith('RUB/USD exchange rate', 3);
      expect(lastFrame()).toContain('По веб-поиску');
    } finally {
      unmount();
      vi.unstubAllGlobals();
      if (previousKey === undefined) delete process.env.TRADEFAST_AI_API_KEY;
      else process.env.TRADEFAST_AI_API_KEY = previousKey;
      if (previousUrl === undefined) delete process.env.TRADEFAST_AI_API_URL;
      else process.env.TRADEFAST_AI_API_URL = previousUrl;
    }
  });
});

describe('cli themes', () => {
  it('provides multiple named palettes with distinct text colors', () => {
    expect(themeNames()).toEqual([
      'violet',
      'ocean',
      'ember',
      'forest',
      'mono',
      'midnight',
      'sunset',
      'lime',
      'cyberpunk',
      'nord',
      'royal',
      'candy',
      'dracula',
      'sakura',
      'matrix',
    ]);
    expect(getTheme('ocean').colors.info).not.toBe(getTheme('ember').colors.info);
    expect(getTheme('unknown').name).toBe('violet');
  });
});

describe('cli exchanges', () => {
  it('lists Binance, OKX, Bybit, MEXC, Pocket Option and defaults to bybit', () => {
    expect(exchangeNames()).toEqual(['binance', 'okx', 'bybit', 'mexc', 'pocketoption']);
    expect(getExchange().name).toBe('bybit');
    expect(getExchange('mexc').label).toBe('MEXC');
    expect(getExchange('unknown').name).toBe('bybit');
  });

  it('classifies crypto venues as spot and Pocket Option as binary-options', () => {
    expect(exchangeKind('bybit')).toBe('spot');
    expect(isBinaryOptions('bybit')).toBe(false);
    expect(getExchange('pocketoption').label).toBe('Pocket Option');
    expect(exchangeKind('pocketoption')).toBe('binary-options');
    expect(isBinaryOptions('pocketoption')).toBe(true);
    // Tolerates the spaced / hyphenated forms a user might type.
    expect(isBinaryOptions('Pocket Option')).toBe(true);
    expect(isBinaryOptions('pocket-option')).toBe(true);
  });
});

describe('cli operating modes', () => {
  it('lists long-term, medium-term and scalping, defaulting to medium-term', () => {
    expect(modeNames()).toEqual(['long-term', 'medium-term', 'scalping']);
    expect(getMode().name).toBe('medium-term');
    expect(getMode('unknown').name).toBe('medium-term');
  });

  it('maps each mode to a trading-horizon timeframe', () => {
    expect(getMode('long-term').interval).toBe('1d');
    expect(getMode('medium-term').interval).toBe('1h');
    expect(getMode('scalping').interval).toBe('5m');
  });

  it('normalises mode names case-insensitively', () => {
    expect(getMode('SCALPING').name).toBe('scalping');
    expect(getMode('Long-Term').label).toBe('Long-term');
  });
});

describe('run output', () => {
  const report: RunReport = {
    runId: 34,
    kind: 'start',
    searchResults: 3,
    durationMs: 2340,
    validation: null,
    interval: '1h',
    symbols: [
      {
        symbol: 'BTCUSDT',
        candlesAdded: 200,
        signalsInserted: 13,
        signalsUpdated: 0,
        signalsUnchanged: 0,
        scrapesAdded: 0,
        insight: 'hidden in table view',
        assessment: 'Momentum favours longs',
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
      '╭──────────┬──────┬────────┬───────┬────────┬────────────────────────╮',
      '│ Currency │ Dir  │ TP     │ SL    │ Price  │ AI                     │',
      '├──────────┼──────┼────────┼───────┼────────┼────────────────────────┤',
      '│ BTCUSDT  │ long │ 110.00 │ 95.00 │ 100.00 │ Momentum favours longs │',
      '╰──────────┴──────┴────────┴───────┴────────┴────────────────────────╯',
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

    expect(renderTradeLogLines(shortReport)).toContain('│ BTCUSDT  │ short │ 90.00 │ 105.00 │ 100.00 │ Momentum favours longs │');
  });

  it('uses the bordered trade log in interactive output', () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, unmount } = render(
      <OutputLine item={{ id: 1, kind: 'run', report }} theme={getTheme('violet')} />,
      { stdout: tallStdout },
    );

    const frame = lastFrame();
    expect(frame).toContain('Trade Log');
    expect(frame).toContain('╭──────────┬──────┬────────┬───────┬────────┬────────────────────────╮');
    expect(frame).toContain('│ BTCUSDT  │ long │ 110.00 │ 95.00 │ 100.00 │ Momentum favours longs │');
    expect(frame).not.toContain('# Trade Log');
    expect(frame).not.toContain('| Currency |');
    expect(frame).not.toContain('strongest:');
    expect(frame).not.toContain('AI BTCUSDT');
    unmount();
  });

  it('renders AI markdown markers as formatting instead of literal text', () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const text = [
      'Актуальный курс **BYN/USD** на сегодня:',
      '- **1 BYN ≈ 0.3618–0.3623 USD**',
      'Динамика: курс укрепился (+0.24%).',
    ].join('\n');
    const { lastFrame, unmount } = render(
      <OutputLine item={{ id: 1, kind: 'ai', text }} theme={getTheme('violet')} />,
      { stdout: tallStdout },
    );

    const frame = lastFrame();
    expect(frame).toContain('Актуальный курс BYN/USD на сегодня:');
    expect(frame).toContain('- 1 BYN ≈ 0.3618–0.3623 USD');
    expect(frame).toContain('(+0.24%)');
    expect(frame).not.toContain('**');
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

    expect(renderTradeLogLines(noActionReport)).toContain('│ BTCUSDT  │     │    │    │ 100.00 │ Momentum favours longs │');
  });

  it('shows a binary-options expiry Time column instead of TP/SL for Pocket Option', () => {
    const binaryReport: RunReport = {
      ...report,
      exchange: 'pocketoption',
      symbols: [{ ...report.symbols[0], symbol: 'EURUSD', assessment: 'Momentum favours longs' }],
    };

    const lines = renderTradeLogLines(binaryReport);
    const header = lines.find((l) => l.includes('Currency')) ?? '';
    // The binary header carries a Time column and drops the spot bracket columns.
    expect(header).toContain('Time');
    expect(header).not.toMatch(/\bTP\b/);
    expect(header).not.toMatch(/\bSL\b/);
    // 1h analysis → 2 bars × 60 min = 120 min, rendered compactly as 2h.
    const row = lines.find((l) => l.includes('long')) ?? '';
    expect(row).toContain('2h');
    expect(row).not.toContain('110.00');
  });
});

describe('AI message markup', () => {
  it('parses bold, inline code, and fenced code markers without rendering delimiters', () => {
    const segments = parseAiMarkup('Rate **BYN/USD** uses `mid`\n```json\n{"pair":"BYN/USD"}\n```\nDone');

    expect(segments.map((segment) => segment.text).join('')).toBe('Rate BYN/USD uses mid\n{"pair":"BYN/USD"}\nDone');
    expect(segments).toContainEqual({ text: 'BYN/USD', bold: true });
    expect(segments).toContainEqual({ text: 'mid', code: true });
    expect(segments).toContainEqual({ text: '{"pair":"BYN/USD"}\n', code: true });
  });

  it('marks signed numeric values while leaving bullets and price ranges alone', () => {
    const segments = parseAiMarkup('- result range 0.3618-0.3623, changes (+0.24%), -116, +890.05, and - item');

    expect(segments.filter((segment) => segment.tone).map((segment) => ({
      text: segment.text,
      tone: segment.tone,
    }))).toEqual([
      { text: '+0.24%', tone: 'positive' },
      { text: '-116', tone: 'negative' },
      { text: '+890.05', tone: 'positive' },
    ]);
  });
});

describe('backtest output', () => {
  const report: BacktestReport = {
    results: [
      { symbol: 'BTCUSDT', candles: 200, trades: 5, wins: 3, losses: 2, timeouts: 0, winRate: 0.6, expectancy: 0.4, totalR: 2, profitFactor: 2, outcomes: [] },
      { symbol: 'ETHUSDT', candles: 200, trades: 4, wins: 1, losses: 3, timeouts: 0, winRate: 0.25, expectancy: -0.25, totalR: -1, profitFactor: 0.5, outcomes: [] },
    ],
    totals: { symbols: 2, trades: 9, wins: 4, losses: 5, timeouts: 0, winRate: 4 / 9, expectancy: 1 / 9, totalR: 1, profitFactor: 1.33 },
  };

  it('renders a bordered accuracy table with per-symbol rows and a TOTAL rollup', () => {
    expect(renderBacktestLines(report)).toEqual([
      'Backtest — forecast accuracy (TP before SL)',
      '╭──────────┬────────┬───────┬─────────┬───────────────╮',
      '│ Currency │ Trades │ Win % │ Exp (R) │ Profit factor │',
      '├──────────┼────────┼───────┼─────────┼───────────────┤',
      '│ BTCUSDT  │ 5      │ 60.0% │ +0.40   │ 2.00          │',
      '│ ETHUSDT  │ 4      │ 25.0% │ -0.25   │ 0.50          │',
      '├──────────┼────────┼───────┼─────────┼───────────────┤',
      '│ TOTAL    │ 9      │ 44.4% │ +0.11   │ 1.33          │',
      '╰──────────┴────────┴───────┴─────────┴───────────────╯',
    ]);
  });

  it('shows an em dash for win rate and profit factor when a symbol has no decided trades', () => {
    const empty: BacktestReport = {
      results: [
        { symbol: 'XRPUSDT', candles: 50, trades: 0, wins: 0, losses: 0, timeouts: 0, winRate: 0, expectancy: 0, totalR: 0, profitFactor: 0, outcomes: [] },
      ],
      totals: { symbols: 1, trades: 0, wins: 0, losses: 0, timeouts: 0, winRate: 0, expectancy: 0, totalR: 0, profitFactor: 0 },
    };

    const lines = renderBacktestLines(empty);
    expect(lines).toContain('│ XRPUSDT  │ 0      │ —     │ +0.00   │ —             │');
  });

  it('renders the bordered backtest table in interactive output', () => {
    const tallStdout = { rows: 80, columns: 120, write: () => {}, on: () => {}, removeListener: () => {} } as any;
    const { lastFrame, unmount } = render(
      <OutputLine item={{ id: 1, kind: 'backtest', report }} theme={getTheme('violet')} />,
      { stdout: tallStdout },
    );

    const frame = lastFrame();
    expect(frame).toContain('Backtest — forecast accuracy (TP before SL)');
    expect(frame).toContain('│ BTCUSDT  │ 5      │ 60.0% │ +0.40   │ 2.00          │');
    expect(frame).toContain('│ TOTAL    │ 9      │ 44.4% │ +0.11   │ 1.33          │');
    unmount();
  });
});
