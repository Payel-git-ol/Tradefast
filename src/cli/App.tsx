import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { Lostfast } from '../app/lostfast.js';
import { ChatService } from '../services/chat.js';
import { COMMANDS, completeCommand, parseCommand, suggestCommands, type CommandSpec } from './commands.js';
import { OutputLine, type OutputItem } from './output.js';
import { saveTheme, saveExchange, saveInterval, saveMode, saveSearchingLevel, saveSearchingPlatforms } from './preferences.js';
import { getTheme, themeNames, type CliTheme, type ThemeName } from './theme.js';
import { getExchange, exchangeNames, type ExchangeName } from './exchanges.js';
import { getInterval, intervalNames, type IntervalName } from './intervals.js';
import { getMode, modeNames, type ModeName } from './modes.js';
import { searchLevelNames, getSearchLevel, type SearchLevelName } from './search-level.js';
import { sourceGroupIds, getSourceGroup, resolveSourceIds, DEFAULT_ENABLED_GROUPS, type SourceGroupId } from './sources.js';

export interface AppProps {
  app: Lostfast;
  version: string;
  apiUrl?: string;
  /** When true (first run, no saved mode), the operating-mode popup opens on
   *  launch so the user picks a trading style before starting. */
  promptOperatingMode?: boolean;
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

function IntervalSelector({
  theme,
  selectedIndex,
  current,
}: {
  theme: CliTheme;
  selectedIndex: number;
  current: IntervalName;
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
        Select trading timeframe
      </Text>
      {intervalNames().map((name, index) => {
        const option = getInterval(name);
        const selected = index === selectedIndex;
        const isCurrent = option.name === current;

        return (
          <Text key={name} color={selected ? theme.colors.info : undefined}>
            {selected ? '> ' : '  '}
            <Text bold={selected}>{option.label.padEnd(10)}</Text>
            {isCurrent ? <Text color={theme.colors.muted}> current</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

function ModeSelector({
  theme,
  selectedIndex,
  current,
}: {
  theme: CliTheme;
  selectedIndex: number;
  current: ModeName;
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
        Select operating mode
      </Text>
      {modeNames().map((name, index) => {
        const option = getMode(name);
        const selected = index === selectedIndex;
        const isCurrent = option.name === current;

        return (
          <Text key={name} color={selected ? theme.colors.info : undefined}>
            {selected ? '> ' : '  '}
            <Text bold={selected}>{option.label.padEnd(14)}</Text>
            <Text color={theme.colors.muted}>{option.description}</Text>
            {isCurrent ? <Text color={theme.colors.muted}> (current)</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

function CurrencySelector({
  theme,
  selectedIndex,
  symbols,
}: {
  theme: CliTheme;
  selectedIndex: number;
  symbols: string[];
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
        Select currency for detailed forecast
      </Text>
      {symbols.map((symbol, index) => {
        const selected = index === selectedIndex;
        return (
          <Text key={symbol} color={selected ? theme.colors.info : undefined}>
            {selected ? '> ' : '  '}
            <Text bold={selected}>{symbol.padEnd(10)}</Text>
            {selected ? <Text color={theme.colors.muted}> press Enter to analyse</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

function LevelSelector({
  theme,
  selectedIndex,
  current,
}: {
  theme: CliTheme;
  selectedIndex: number;
  current: SearchLevelName;
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
        Select research depth
      </Text>
      {searchLevelNames().map((name, index) => {
        const option = getSearchLevel(name);
        const selected = index === selectedIndex;
        const isCurrent = option.name === current;

        return (
          <Text key={name} color={selected ? theme.colors.info : undefined}>
            {selected ? '> ' : '  '}
            <Text bold={selected}>{option.label.padEnd(8)}</Text>
            <Text color={theme.colors.muted}>{option.description}</Text>
            {isCurrent ? <Text color={theme.colors.muted}> (current)</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

function PlatformSelector({
  theme,
  cursorIndex,
  enabledGroups,
}: {
  theme: CliTheme;
  cursorIndex: number;
  enabledGroups: SourceGroupId[];
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
        Select research platforms
      </Text>
      <Text color={theme.colors.muted}>
        Space=toggle, Enter=done, Esc=cancel
      </Text>
      {sourceGroupIds().map((id, index) => {
        const group = getSourceGroup(id)!;
        const checked = enabledGroups.includes(id);
        const focused = index === cursorIndex;

        return (
          <Text key={id} color={focused ? theme.colors.info : undefined}>
            {focused ? '> ' : '  '}
            <Text bold={focused}>{checked ? '[x]' : '[ ]'}</Text>
            {' '}
            <Text bold={focused && checked}>{group.label}</Text>
            {' '}
            <Text color={theme.colors.muted}>{group.description}</Text>
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
export function App({ app, version, apiUrl, promptOperatingMode }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [theme, setTheme] = useState(() => getTheme(app.config.theme));
  const [history, setHistory] = useState<OutputItem[]>([
    { id: 0, kind: 'banner', version, driver: app.driver, model: app.config.model },
  ]);
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<CommandSpec[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);
  const [exchangeSelectorOpen, setExchangeSelectorOpen] = useState(false);
  const [selectedExchangeIndex, setSelectedExchangeIndex] = useState(0);
  const [exchange, setExchange] = useState<ExchangeName>(() => getExchange(app.config.exchange).name as ExchangeName);
  const [intervalSelectorOpen, setIntervalSelectorOpen] = useState(false);
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState(0);
  const [interval, setInterval] = useState<IntervalName>(() => getInterval(app.config.interval).name as IntervalName);
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const [selectedModeIndex, setSelectedModeIndex] = useState(0);
  const [mode, setMode] = useState<ModeName>(() => getMode(app.config.mode).name as ModeName);
  const [currencySelectorOpen, setCurrencySelectorOpen] = useState(false);
  const [selectedCurrencyIndex, setSelectedCurrencyIndex] = useState(0);
  const [levelSelectorOpen, setLevelSelectorOpen] = useState(false);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(0);
  const [searchingLevel, setSearchingLevel] = useState<SearchLevelName>(() => getSearchLevel(app.config.searchingLevel).name as SearchLevelName);
  const [platformSelectorOpen, setPlatformSelectorOpen] = useState(false);
  const [platformCursorIndex, setPlatformCursorIndex] = useState(0);
  const [enabledPlatforms, setEnabledPlatforms] = useState<SourceGroupId[]>(() => {
    if (Array.isArray(app.config.searchingPlatforms) && app.config.searchingPlatforms.length > 0) {
      const valid = app.config.searchingPlatforms.filter((g): g is SourceGroupId =>
        (sourceGroupIds() as string[]).includes(g),
      );
      return valid.length > 0 ? valid : [...DEFAULT_ENABLED_GROUPS];
    }
    return [...DEFAULT_ENABLED_GROUPS];
  });
  const [busy, setBusy] = useState(false);
  const newsCrawlOptions = useCallback(
    () => {
      const level = getSearchLevel(searchingLevel);
      const sourceIds = resolveSourceIds(enabledPlatforms);
      return { sourceIds, maxDepth: level.maxDepth, maxPagesPerSource: level.maxPagesPerSource, maxLinksPerPage: level.maxLinksPerPage, scrollPasses: level.scrollPasses, settleMs: level.settleMs } as const;
    },
    [searchingLevel, enabledPlatforms],
  );
  const [progress, setProgress] = useState<{ message: string; step: number; totalSteps: number } | null>(null);
  const nextId = useRef(1);
  const chatService = useRef(new ChatService());

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
    setSelectedSuggestionIndex(0);
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

  const openIntervalSelector = useCallback(() => {
    const currentIndex = intervalNames().findIndex((name) => name === interval);
    setSelectedIntervalIndex(currentIndex >= 0 ? currentIndex : 0);
    setIntervalSelectorOpen(true);
  }, [interval]);

  const openModeSelector = useCallback(() => {
    const currentIndex = modeNames().findIndex((name) => name === mode);
    setSelectedModeIndex(currentIndex >= 0 ? currentIndex : 0);
    setModeSelectorOpen(true);
  }, [mode]);

  const openCurrencySelector = useCallback(() => {
    setSelectedCurrencyIndex(0);
    setCurrencySelectorOpen(true);
  }, []);

  // First launch (no saved mode yet): ask the user to pick a trading style
  // before they start, as required by the issue. Runs once on mount.
  useEffect(() => {
    if (promptOperatingMode) openModeSelector();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      app.setExchange(next.name);
      push({ kind: 'text', text: `Exchange: ${next.label} (live data source updated)`, color: theme.colors.info });
    },
    [app, push, theme],
  );

  const applyInterval = useCallback(
    (name: IntervalName) => {
      const next = getInterval(name);
      setInterval(next.name as IntervalName);
      setIntervalSelectorOpen(false);
      void saveInterval(next.name as IntervalName);
      app.setInterval(next.name);
      push({ kind: 'text', text: `Trading timeframe: ${next.label}`, color: theme.colors.info });
    },
    [app, push, theme],
  );

  const applyMode = useCallback(
    (name: ModeName) => {
      const next = getMode(name);
      setMode(next.name as ModeName);
      setModeSelectorOpen(false);
      void saveMode(next.name as ModeName);
      app.setMode(next.name);

      // A mode is a trading horizon, so applying it also shifts the active
      // timeframe to that horizon. The user can still fine-tune it afterwards
      // with /operating-mode-time.
      const tf = getInterval(next.interval);
      setInterval(tf.name as IntervalName);
      void saveInterval(tf.name as IntervalName);
      app.setInterval(tf.name);

      push({
        kind: 'text',
        text: `Operating mode: ${next.label} — ${next.description} (timeframe ${tf.label})`,
        color: theme.colors.info,
      });
    },
    [app, push, theme],
  );

  const applyLevel = useCallback(
    (name: SearchLevelName) => {
      const next = getSearchLevel(name);
      setSearchingLevel(next.name as SearchLevelName);
      setLevelSelectorOpen(false);
      void saveSearchingLevel(next.name as SearchLevelName);
      push({ kind: 'text', text: `Research depth: ${next.label} — ${next.description}`, color: theme.colors.info });
    },
    [push, theme],
  );

  const togglePlatform = useCallback(
    (id: SourceGroupId) => {
      setEnabledPlatforms((prev) =>
        prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
      );
    },
    [],
  );

  const applyPlatforms = useCallback(
    () => {
      setPlatformSelectorOpen(false);
      void saveSearchingPlatforms(enabledPlatforms);
      const count = resolveSourceIds(enabledPlatforms).length;
      const groups = enabledPlatforms.map((id) => getSourceGroup(id)?.label ?? id).join(', ');
      push({ kind: 'text', text: `Research platforms: ${groups} (${count} sources)`, color: theme.colors.info });
    },
    [enabledPlatforms, push, theme],
  );

  const applyCurrency = useCallback(
    (symbol: string) => {
      setCurrencySelectorOpen(false);
      setBusy(true);
      void (async () => {
        try {
          const forecast = await app.forecastCurrency(symbol, (e) => setProgress(e));
          push({ kind: 'run', report: forecast.report });
          push({ kind: 'chart', data: { symbol, interval: app.config.interval, candles: forecast.candles } });

          if (forecast.price != null) {
            push({
              kind: 'text',
              text: `${symbol} last price: ${forecast.price}`,
              color: theme.colors.info,
            });
          }

          const news = forecast.newsConsensus;
          if (news.length > 0) {
            const top = news[0];
            const dir = top.crowdBias > 0.15 ? 'bullish' : top.crowdBias < -0.15 ? 'bearish' : 'neutral';
            push({
              kind: 'text',
              text: `News sentiment for ${top.instrument}: ${dir} (bias ${top.crowdBias.toFixed(2)}, ${top.mentions} mentions)`,
              color: theme.colors.muted,
            });
          }
        } catch (error) {
          push({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
          setProgress(null);
        }
      })();
    },
    [app, push, theme],
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

    if (intervalSelectorOpen && !busy) {
      if (key.escape) {
        setIntervalSelectorOpen(false);
      } else if (key.upArrow) {
        setSelectedIntervalIndex((index) => (index - 1 + intervalNames().length) % intervalNames().length);
      } else if (key.downArrow) {
        setSelectedIntervalIndex((index) => (index + 1) % intervalNames().length);
      } else if (key.return) {
        applyInterval(intervalNames()[selectedIntervalIndex]);
      }
      return;
    }

    if (modeSelectorOpen && !busy) {
      if (key.escape) {
        setModeSelectorOpen(false);
      } else if (key.upArrow) {
        setSelectedModeIndex((index) => (index - 1 + modeNames().length) % modeNames().length);
      } else if (key.downArrow) {
        setSelectedModeIndex((index) => (index + 1) % modeNames().length);
      } else if (key.return) {
        applyMode(modeNames()[selectedModeIndex]);
      }
      return;
    }

    if (currencySelectorOpen && !busy) {
      if (key.escape) {
        setCurrencySelectorOpen(false);
      } else if (key.upArrow) {
        setSelectedCurrencyIndex((index) => (index - 1 + app.config.symbols.length) % app.config.symbols.length);
      } else if (key.downArrow) {
        setSelectedCurrencyIndex((index) => (index + 1) % app.config.symbols.length);
      } else if (key.return) {
        applyCurrency(app.config.symbols[selectedCurrencyIndex]);
      }
      return;
    }

    if (levelSelectorOpen && !busy) {
      if (key.escape) {
        setLevelSelectorOpen(false);
      } else if (key.upArrow) {
        setSelectedLevelIndex((index) => (index - 1 + searchLevelNames().length) % searchLevelNames().length);
      } else if (key.downArrow) {
        setSelectedLevelIndex((index) => (index + 1) % searchLevelNames().length);
      } else if (key.return) {
        applyLevel(searchLevelNames()[selectedLevelIndex]);
      }
      return;
    }

    if (platformSelectorOpen && !busy) {
      if (key.escape) {
        setPlatformSelectorOpen(false);
      } else if (key.upArrow) {
        setPlatformCursorIndex((index) => (index - 1 + sourceGroupIds().length) % sourceGroupIds().length);
      } else if (key.downArrow) {
        setPlatformCursorIndex((index) => (index + 1) % sourceGroupIds().length);
      } else if (key.return) {
        applyPlatforms();
      } else if (_input === ' ') {
        togglePlatform(sourceGroupIds()[platformCursorIndex]);
      }
      return;
    }

    if (suggestions.length > 0 && !busy) {
      if (key.upArrow) {
        setSelectedSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (key.downArrow) {
        setSelectedSuggestionIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (key.escape) {
        setSuggestions([]);
        return;
      }
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
        if (args[0] === 'check') {
          push({ kind: 'text', text: `Current exchange: ${getExchange(app.config.exchange).label}`, color: theme.colors.info });
          return;
        }
        const next = getExchange(args[0]);
        if (next.name !== args[0].toLowerCase()) {
          push({ kind: 'error', text: `Unknown exchange "${args[0]}". Available: ${exchangeNames().join(', ')}` });
          return;
        }
        setExchange(next.name as ExchangeName);
        void saveExchange(next.name as ExchangeName);
        app.setExchange(next.name);
        push({ kind: 'text', text: `Exchange: ${next.label} (live data source updated)`, color: theme.colors.info });
        return;
      }
      if (name === 'operating-mode') {
        if (args.length === 0) {
          openModeSelector();
          return;
        }
        if (args[0] === 'check') {
          push({ kind: 'text', text: `Current mode: ${getMode(app.config.mode).label}`, color: theme.colors.info });
          return;
        }
        const next = getMode(args[0]);
        if (next.name !== args[0].toLowerCase()) {
          push({ kind: 'error', text: `Unknown operating mode "${args[0]}". Available: ${modeNames().join(', ')}` });
          return;
        }
        applyMode(next.name as ModeName);
        return;
      }
      if (name === 'operating-mode-time') {
        if (args.length === 0) {
          openIntervalSelector();
          return;
        }
        if (args[0] === 'check') {
          push({ kind: 'text', text: `Current timeframe: ${getInterval(app.config.interval).label}`, color: theme.colors.info });
          return;
        }
        const next = getInterval(args[0]);
        if (next.name !== args[0].toLowerCase()) {
          push({ kind: 'error', text: `Unknown timeframe "${args[0]}". Available: ${intervalNames().join(', ')}` });
          return;
        }
        setInterval(next.name as IntervalName);
        void saveInterval(next.name as IntervalName);
        app.setInterval(next.name);
        push({ kind: 'text', text: `Trading timeframe: ${next.label}`, color: theme.colors.info });
        return;
      }
      if (name === 'serching-level') {
        if (args.length === 0) {
          setSelectedLevelIndex(searchLevelNames().findIndex((n) => n === searchingLevel));
          setLevelSelectorOpen(true);
          return;
        }
        if (args[0] === 'check') {
          const current = getSearchLevel(searchingLevel);
          push({ kind: 'text', text: `Research depth: ${current.label} — ${current.description}`, color: theme.colors.info });
          return;
        }
        const next = getSearchLevel(args[0]);
        if (next.name !== args[0].toLowerCase()) {
          push({ kind: 'error', text: `Unknown search level "${args[0]}". Available: ${searchLevelNames().join(', ')}` });
          return;
        }
        applyLevel(next.name as SearchLevelName);
        return;
      }
      if (name === 'serching-platforms') {
        if (args.length === 0) {
          setPlatformCursorIndex(0);
          setPlatformSelectorOpen(true);
          return;
        }
        if (args[0] === 'check') {
          const groups = enabledPlatforms.map((id) => getSourceGroup(id)?.label ?? id).join(', ');
          const count = resolveSourceIds(enabledPlatforms).length;
          push({ kind: 'text', text: `Research platforms: ${groups} (${count} sources)`, color: theme.colors.info });
          return;
        }
        push({ kind: 'error', text: 'Use /serching-platforms without arguments to open the platform selector.' });
        return;
      }
      if (name === 'strategies') {
        push({ kind: 'strategies', list: app.strategies() });
        return;
      }
      if (name === 'currency') {
        if (args.length === 0) {
          openCurrencySelector();
          return;
        }
        if (args[0] === 'check') {
          push({ kind: 'text', text: `Tracked symbols: ${app.config.symbols.join(', ')}`, color: theme.colors.info });
          return;
        }
        const symbol = args[0].toUpperCase();
        if (!app.config.symbols.includes(symbol)) {
          push({
            kind: 'error',
            text: `Unknown currency "${symbol}". Available: ${app.config.symbols.join(', ')}`,
          });
          return;
        }
        setBusy(true);
        try {
          const forecast = await app.forecastCurrency(symbol, (e) => setProgress(e));
          push({ kind: 'run', report: forecast.report });
          push({ kind: 'chart', data: { symbol, interval: app.config.interval, candles: forecast.candles } });
          if (forecast.price != null) {
            push({ kind: 'text', text: `${symbol} last price: ${forecast.price}`, color: theme.colors.info });
          }
          const news = forecast.newsConsensus;
          if (news.length > 0) {
            const top = news[0];
            const dir = top.crowdBias > 0.15 ? 'bullish' : top.crowdBias < -0.15 ? 'bearish' : 'neutral';
            push({
              kind: 'text',
              text: `News sentiment for ${top.instrument}: ${dir} (bias ${top.crowdBias.toFixed(2)}, ${top.mentions} mentions)`,
              color: theme.colors.muted,
            });
          }
        } catch (error) {
          push({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
          setProgress(null);
        }
        return;
      }
      if (name === 'unknown') {
        if (!chatService.current.enabled) {
          push({ kind: 'error', text: `Unknown command "${raw}". Type /help.` });
          return;
        }
        setBusy(true);
        try {
          const response = await chatService.current.chat(raw, async (toolName, toolArgs) => {
            switch (toolName) {
              case 'run_start':
              case 'run_update': {
                const report = await (toolName === 'run_start'
                  ? app.start((e) => setProgress(e))
                  : app.update((e) => setProgress(e)));
                push({ kind: 'run', report });
                  return JSON.stringify(report.symbols.map(s => {
                  const cs = s.analysis.analytics.consensusScore;
                  return {
                    symbol: s.symbol,
                    direction: cs > 0.15 ? 'long' : cs < -0.15 ? 'short' : 'neutral',
                    consensusScore: cs,
                    assessment: s.assessment,
                  };
                }));
              }
              case 'run_backtest': {
                const report = await app.backtest((e) => setProgress(e));
                push({ kind: 'backtest', report });
                return JSON.stringify({
                  symbols: report.results.map(r => r.symbol),
                  totalTrades: report.totals.trades,
                  winRate: report.totals.winRate,
                  expectancy: report.totals.expectancy,
                });
              }
              case 'run_news': {
                const report = await app.news((e) => setProgress(e), newsCrawlOptions());
                push({ kind: 'news', report });
                return JSON.stringify({
                  sources: report.sources.length,
                  items: report.items.length,
                  inserted: report.inserted,
                });
              }
              case 'run_status': {
                const status = await app.status();
                push({ kind: 'status', status });
                return JSON.stringify(status);
              }
              case 'run_clear': {
                const pruned = await app.clear();
                push({
                  kind: 'text',
                  text: `Pruned ${pruned} outdated run(s). Search table preserved.`,
                  color: theme.colors.info,
                });
                return `Pruned ${pruned} outdated runs.`;
              }
              case 'run_strategies': {
                const list = app.strategies();
                push({ kind: 'strategies', list });
                return JSON.stringify(list);
              }
              case 'run_theme': {
                const tName = (toolArgs.name as string) || '';
                if (tName) {
                  const next = getTheme(tName);
                  if (next.name === tName.toLowerCase()) {
                    setTheme(next);
                    void saveTheme(next.name as ThemeName);
                    push({ kind: 'text', text: `Theme: ${next.label}`, color: next.colors.info });
                    return `Theme changed to ${next.label}.`;
                  }
                }
                openThemeSelector();
                return 'Theme selector opened — pick a theme.';
              }
              case 'run_exchange': {
                const eName = (toolArgs.name as string) || '';
                if (eName) {
                  const next = getExchange(eName);
                  if (next.name === eName.toLowerCase()) {
                    setExchange(next.name as ExchangeName);
                    void saveExchange(next.name as ExchangeName);
                    app.setExchange(next.name);
                    push({ kind: 'text', text: `Exchange: ${next.label} (live data source updated)`, color: theme.colors.info });
                    return `Exchange changed to ${next.label}.`;
                  }
                }
                openExchangeSelector();
                return 'Exchange selector opened — pick an exchange.';
              }
              case 'run_operating_mode': {
                const mName = (toolArgs.name as string) || '';
                if (mName) {
                  const next = getMode(mName);
                  if (next.name === mName.toLowerCase()) {
                    applyMode(next.name as ModeName);
                    return `Operating mode changed to ${next.label}.`;
                  }
                }
                openModeSelector();
                return 'Mode selector opened — pick a mode.';
              }
              case 'run_operating_mode_time': {
                const iName = (toolArgs.name as string) || '';
                if (iName) {
                  const next = getInterval(iName);
                  if (next.name === iName.toLowerCase()) {
                    setInterval(next.name as IntervalName);
                    void saveInterval(next.name as IntervalName);
                    app.setInterval(next.name);
                    push({ kind: 'text', text: `Trading timeframe: ${next.label}`, color: theme.colors.info });
                    return `Timeframe changed to ${next.label}.`;
                  }
                }
                openIntervalSelector();
                return 'Timeframe selector opened — pick a timeframe.';
              }
              case 'run_currency': {
                const symbol = ((toolArgs.symbol as string) || '').toUpperCase();
                if (symbol && app.config.symbols.includes(symbol)) {
                  const forecast = await app.forecastCurrency(symbol, (e) => setProgress(e));
                  push({ kind: 'run', report: forecast.report });
                  push({ kind: 'chart', data: { symbol, interval: app.config.interval, candles: forecast.candles } });
                  if (forecast.price != null) {
                    push({ kind: 'text', text: `${symbol} last price: ${forecast.price}`, color: theme.colors.info });
                  }
                  const cs = forecast.report.symbols[0]?.analysis.analytics.consensusScore ?? 0;
                  return JSON.stringify({
                    symbol,
                    price: forecast.price,
                    direction: cs > 0.15 ? 'long' : cs < -0.15 ? 'short' : 'neutral',
                  });
                }
                openCurrencySelector();
                return 'Currency selector opened — pick a currency.';
              }
              case 'run_help': {
                const text = COMMANDS.map(c => `  ${c.name.padEnd(12)} ${c.summary}`).join('\n');
                return `Available commands:\n${text}`;
              }
              case 'run_serching_level': {
                const slName = (toolArgs.name as string) || '';
                if (slName) {
                  const next = getSearchLevel(slName);
                  if (next.name === slName.toLowerCase()) {
                    applyLevel(next.name as SearchLevelName);
                    return `Research depth changed to ${next.label}.`;
                  }
                }
                setSelectedLevelIndex(searchLevelNames().findIndex((n) => n === searchingLevel));
                setLevelSelectorOpen(true);
                return 'Level selector opened — pick a depth.';
              }
              case 'run_serching_platforms': {
                const groups = toolArgs.groups as string[] | undefined;
                if (groups && Array.isArray(groups) && groups.length > 0) {
                  const valid = groups.filter((g) => sourceGroupIds().includes(g as SourceGroupId));
                  if (valid.length > 0) {
                    setEnabledPlatforms(valid as SourceGroupId[]);
                    void saveSearchingPlatforms(valid as SourceGroupId[]);
                    const count = resolveSourceIds(valid as SourceGroupId[]).length;
                    return `Research platforms set to ${valid.length} group(s) (${count} sources).`;
                  }
                }
                setPlatformCursorIndex(0);
                setPlatformSelectorOpen(true);
                return 'Platform selector opened — toggle sources with Space, confirm with Enter.';
              }
              case 'get_exchange':
                return app.config.exchange;
              case 'get_timeframe':
                return app.config.interval;
              case 'get_mode':
                return app.config.mode;
              case 'get_currency':
                return JSON.stringify(app.config.symbols);
              default:
                return `Unknown tool: ${toolName}`;
            }
          });
          push({ kind: 'ai', text: response });
        } catch (error) {
          push({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
        } finally {
          setBusy(false);
          setProgress(null);
        }
        return;
      }

      setBusy(true);
      try {
        if (name === 'start' || name === 'update') {
          const report = await (name === 'start'
            ? app.start((e) => setProgress(e))
            : app.update((e) => setProgress(e)));
          push({ kind: 'run', report });
        } else if (name === 'backtest') {
          push({ kind: 'backtest', report: await app.backtest((e) => setProgress(e)) });
        } else if (name === 'news') {
          push({ kind: 'news', report: await app.news((e) => setProgress(e), newsCrawlOptions()) });
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
    [apiUrl, app, openThemeSelector, openExchangeSelector, openIntervalSelector, openModeSelector, openCurrencySelector, applyMode, applyLevel, applyPlatforms, searchingLevel, enabledPlatforms, newsCrawlOptions, push, quit, theme],
  );

  const onSubmit = useCallback(
    (raw: string) => {
      if (suggestions.length > 0) {
        setValue(suggestions[selectedSuggestionIndex].name);
        setSuggestions([]);
        return;
      }
      const trimmed = raw.trim();
      setValue('');
      setSuggestions([]);
      if (trimmed.length > 0 && !busy) void run(trimmed);
    },
    [suggestions, selectedSuggestionIndex, busy, run],
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
          ) : intervalSelectorOpen ? (
            <IntervalSelector theme={theme} selectedIndex={selectedIntervalIndex} current={interval} />
          ) : modeSelectorOpen ? (
            <ModeSelector theme={theme} selectedIndex={selectedModeIndex} current={mode} />
          ) : currencySelectorOpen ? (
            <CurrencySelector theme={theme} selectedIndex={selectedCurrencyIndex} symbols={app.config.symbols} />
          ) : levelSelectorOpen ? (
            <LevelSelector theme={theme} selectedIndex={selectedLevelIndex} current={searchingLevel} />
          ) : platformSelectorOpen ? (
            <PlatformSelector
              theme={theme}
              cursorIndex={platformCursorIndex}
              enabledGroups={enabledPlatforms}
            />
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
                  {suggestions.map((command, index) => (
                    <Text key={command.name}>
                      <Text color={theme.colors.accent}>
                        {index === selectedSuggestionIndex ? '> ' : '  '}
                      </Text>
                      <Text
                        bold={index === selectedSuggestionIndex}
                        color={theme.colors.info}
                      >
                        {command.name.padEnd(12)}
                      </Text>
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
