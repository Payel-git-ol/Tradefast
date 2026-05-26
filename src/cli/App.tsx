import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import React, { useCallback, useRef, useState } from 'react';

import type { Lostfast } from '../app/lostfast.js';
import { COMMANDS, completeCommand, parseCommand, suggestCommands, type CommandSpec } from './commands.js';
import { OutputLine, type OutputItem } from './output.js';
import { saveTheme, saveExchange } from './preferences.js';
import { getTheme, themeNames, type CliTheme, type ThemeName } from './theme.js';
import { getExchange, exchangeNames, type ExchangeName } from './exchanges.js';

export interface AppProps {
  app: Lostfast;
  version: string;
  apiUrl?: string;
}

function ThemeSelector({
  theme,
  selectedIndex,
}: {
  theme: CliTheme;
  selectedIndex: number;
}): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border}
      paddingX={1}
      marginTop={1}
    >
      <Text bold color={theme.colors.accent}>
        Select theme
      </Text>
      {themeNames().map((name, index) => {
        const option = getTheme(name);
        const selected = index === selectedIndex;
        const current = option.name === theme.name;

        return (
          <Text key={name} color={selected ? theme.colors.info : undefined}>
            {selected ? '> ' : '  '}
            <Text bold={selected}>{option.label.padEnd(8)}</Text>
            {current ? <Text color={theme.colors.muted}> current</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

function ExchangeSelector({
  theme,
  selectedIndex,
  current,
}: {
  theme: CliTheme;
  selectedIndex: number;
  current: ExchangeName;
}): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border}
      paddingX={1}
      marginTop={1}
    >
      <Text bold color={theme.colors.accent}>
        Select exchange
      </Text>
      {exchangeNames().map((name, index) => {
        const option = getExchange(name);
        const selected = index === selectedIndex;
        const isCurrent = option.name === current;

        return (
          <Text key={name} color={selected ? theme.colors.info : undefined}>
            {selected ? '> ' : '  '}
            <Text bold={selected}>{option.label.padEnd(8)}</Text>
            {isCurrent ? <Text color={theme.colors.muted}> current</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * The interactive shell. A static banner and transcript scroll above a single
 * input line — the same layout as the Gemini CLI. All side effects go through
 * the injected {@link Lostfast} facade; this component only manages UI state.
 */
export function App({ app, version, apiUrl }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [theme, setTheme] = useState(() => getTheme(app.config.theme));
  const [history, setHistory] = useState<OutputItem[]>([
    { id: 0, kind: 'banner', version, driver: app.driver, model: app.config.model },
  ]);
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<CommandSpec[]>([]);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);
  const [exchangeSelectorOpen, setExchangeSelectorOpen] = useState(false);
  const [selectedExchangeIndex, setSelectedExchangeIndex] = useState(0);
  const [exchange, setExchange] = useState<ExchangeName>(() => getExchange(app.config.exchange).name as ExchangeName);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ message: string; step: number; totalSteps: number } | null>(null);
  const nextId = useRef(1);

  // Distributive omit so each union member keeps its own discriminant + fields.
  const push = useCallback((item: OutputItem extends infer T ? (T extends T ? Omit<T, 'id'> : never) : never) => {
    setHistory((h) => [...h, { ...item, id: nextId.current++ } as OutputItem]);
  }, []);

  const quit = useCallback(async () => {
    await app.close();
    exit();
  }, [app, exit]);

  const changeValue = useCallback((next: string) => {
    setValue(next);
    setSuggestions(suggestCommands(next).slice(0, 5));
  }, []);

  const openThemeSelector = useCallback(() => {
    const currentIndex = themeNames().findIndex((name) => name === theme.name);
    setSelectedThemeIndex(currentIndex >= 0 ? currentIndex : 0);
    setThemeSelectorOpen(true);
  }, [theme.name]);

  const openExchangeSelector = useCallback(() => {
    const currentIndex = exchangeNames().findIndex((name) => name === exchange);
    setSelectedExchangeIndex(currentIndex >= 0 ? currentIndex : 0);
    setExchangeSelectorOpen(true);
  }, [exchange]);

  const applyTheme = useCallback(
    (name: ThemeName) => {
      const next = getTheme(name);
      setTheme(next);
      setThemeSelectorOpen(false);
      void saveTheme(next.name as ThemeName);
      push({ kind: 'text', text: `Theme: ${next.label}`, color: next.colors.info });
    },
    [push],
  );

  const applyExchange = useCallback(
    (name: ExchangeName) => {
      const next = getExchange(name);
      setExchange(next.name as ExchangeName);
      setExchangeSelectorOpen(false);
      void saveExchange(next.name as ExchangeName);
      push({ kind: 'text', text: `Exchange: ${next.label}`, color: theme.colors.info });
    },
    [push, theme],
  );

  useInput((_input, key) => {
    if (themeSelectorOpen && !busy) {
      if (key.escape) {
        setThemeSelectorOpen(false);
      } else if (key.upArrow) {
        setSelectedThemeIndex((index) => (index - 1 + themeNames().length) % themeNames().length);
      } else if (key.downArrow) {
        setSelectedThemeIndex((index) => (index + 1) % themeNames().length);
      } else if (key.return) {
        applyTheme(themeNames()[selectedThemeIndex]);
      }
      return;
    }

    if (exchangeSelectorOpen && !busy) {
      if (key.escape) {
        setExchangeSelectorOpen(false);
      } else if (key.upArrow) {
        setSelectedExchangeIndex((index) => (index - 1 + exchangeNames().length) % exchangeNames().length);
      } else if (key.downArrow) {
        setSelectedExchangeIndex((index) => (index + 1) % exchangeNames().length);
      } else if (key.return) {
        applyExchange(exchangeNames()[selectedExchangeIndex]);
      }
      return;
    }

    if (key.escape && !busy) void quit();
    if (key.tab && !busy) {
      const completed = completeCommand(value);
      if (completed) {
        setValue(completed);
        setSuggestions([]);
      } else {
        setSuggestions(suggestCommands(value).slice(0, 5));
      }
    }
  });

  const run = useCallback(
    async (raw: string) => {
      const { name, args } = parseCommand(raw);
      push({ kind: 'echo', text: raw });

      if (name === 'exit') {
        await quit();
        return;
      }
      if (name === 'help') {
        push({ kind: 'text', text: 'Commands:', color: theme.colors.accent });
        for (const c of COMMANDS) push({ kind: 'text', text: `  ${c.name.padEnd(12)} ${c.summary}` });
        return;
      }
      if (name === 'api') {
        push({ kind: 'text', text: apiUrl ? `GraphQL API: ${apiUrl}` : 'GraphQL API disabled', color: theme.colors.info });
        return;
      }
      if (name === 'theme') {
        if (args.length === 0) {
          openThemeSelector();
          return;
        }
        const next = getTheme(args[0]);
        if (next.name !== args[0].toLowerCase()) {
          push({ kind: 'error', text: `Unknown theme "${args[0]}". Available: ${themeNames().join(', ')}` });
          return;
        }
        setTheme(next);
        void saveTheme(next.name as ThemeName);
        push({ kind: 'text', text: `Theme: ${next.label}`, color: next.colors.info });
        return;
      }
      if (name === 'exchange') {
        if (args.length === 0) {
          openExchangeSelector();
          return;
        }
        const next = getExchange(args[0]);
        if (next.name !== args[0].toLowerCase()) {
          push({ kind: 'error', text: `Unknown exchange "${args[0]}". Available: ${exchangeNames().join(', ')}` });
          return;
        }
        setExchange(next.name as ExchangeName);
        void saveExchange(next.name as ExchangeName);
        push({ kind: 'text', text: `Exchange: ${next.label}`, color: theme.colors.info });
        return;
      }
      if (name === 'strategies') {
        push({ kind: 'strategies', list: app.strategies() });
        return;
      }
      if (name === 'unknown') {
        push({ kind: 'error', text: `Unknown command "${raw}". Type /help.` });
        return;
      }

      setBusy(true);
      try {
        if (name === 'start' || name === 'update') {
          const report = await (name === 'start'
            ? app.start((e) => setProgress(e))
            : app.update((e) => setProgress(e)));
          push({ kind: 'run', report });
        } else if (name === 'news') {
          push({ kind: 'news', report: await app.news((e) => setProgress(e)) });
        } else if (name === 'status') {
          push({ kind: 'status', status: await app.status() });
        } else if (name === 'clear') {
          const pruned = await app.clear();
          push({
            kind: 'text',
            text: `Pruned ${pruned} outdated run(s). Search table preserved.`,
            color: theme.colors.info,
          });
        }
      } catch (error) {
        push({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [apiUrl, app, openThemeSelector, openExchangeSelector, push, quit, theme],
  );

  const onSubmit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      setValue('');
      setSuggestions([]);
      if (trimmed.length > 0 && !busy) void run(trimmed);
    },
    [busy, run],
  );

  return (
    <Box flexDirection="column">
      {history.map((item) => (
        <OutputLine key={item.id} item={item} theme={theme} apiUrl={apiUrl} />
      ))}

      {busy ? (
        <Box>
          <Text color={theme.colors.accent}>
            <Spinner type="dots" />
          </Text>
          <Text> {progress ? `${progress.message} (${progress.step}/${progress.totalSteps})` : 'Working…'}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {themeSelectorOpen ? (
            <ThemeSelector theme={theme} selectedIndex={selectedThemeIndex} />
          ) : exchangeSelectorOpen ? (
            <ExchangeSelector theme={theme} selectedIndex={selectedExchangeIndex} current={exchange} />
          ) : (
            <>
              <Box>
                <Text color={theme.colors.accent}>{'> '}</Text>
                <TextInput
                  value={value}
                  onChange={changeValue}
                  onSubmit={onSubmit}
                  placeholder="type a command, e.g. /start  (/help for all)"
                />
              </Box>
              {suggestions.length > 0 ? (
                <Box flexDirection="column" marginLeft={2}>
                  {suggestions.map((command) => (
                    <Text key={command.name}>
                      <Text color={theme.colors.info}>{command.name.padEnd(12)}</Text>
                      <Text color={theme.colors.muted}>{command.summary}</Text>
                    </Text>
                  ))}
                </Box>
              ) : null}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
