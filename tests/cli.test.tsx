import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import type { Lostfast } from '../src/app/lostfast.js';
import { App } from '../src/cli/App.js';
import { completeCommand, parseCommand, suggestCommands } from '../src/cli/commands.js';
import { getTheme, themeNames } from '../src/cli/theme.js';

const fakeApp = {
  driver: 'test',
  config: {
    symbols: ['BTCUSDT'],
    interval: '1h',
    candleLimit: 120,
    accountBalance: 10_000,
    model: 'test-model',
    theme: 'violet',
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
  });

  it('completes unambiguous command prefixes', () => {
    expect(completeCommand('/stat')).toBe('/status');
    expect(completeCommand('up')).toBe('/update');
    expect(completeCommand('/s')).toBeNull();
  });

  it('parses theme command arguments', () => {
    expect(parseCommand('/theme ocean')).toMatchObject({ name: 'theme', token: 'theme', args: ['ocean'] });
  });

  it('renders command suggestions while typing', () => {
    const { lastFrame, stdin, unmount } = render(
      <App app={fakeApp} version="0.0.0-test" apiUrl="http://127.0.0.1:8787/graphql" />,
    );

    stdin.write('/stat');

    expect(lastFrame()).toContain('/status');
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
