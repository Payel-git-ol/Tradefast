import { Box, Text } from 'ink';
import React from 'react';

import type { StatusReport } from '../app/lostfast.js';
import type { RunReport } from '../pipeline/collector.js';
import { Banner } from './Banner.js';
import { COLORS, directionColor } from './theme.js';

/** A single entry in the scrolling transcript. */
export type OutputItem =
  | { id: number; kind: 'banner'; version: string; driver: string; model: string }
  | { id: number; kind: 'echo'; text: string }
  | { id: number; kind: 'text'; text: string; color?: string }
  | { id: number; kind: 'error'; text: string }
  | { id: number; kind: 'run'; report: RunReport }
  | { id: number; kind: 'status'; status: StatusReport }
  | { id: number; kind: 'strategies'; list: { id: string; title: string }[] };

const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;

function RunView({ report }: { report: RunReport }): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text>
        <Text color={COLORS.accent} bold>
          ▌Run #{report.runId}
        </Text>{' '}
        <Text color={COLORS.muted}>
          ({report.kind}, {report.symbols.length} symbol(s), {report.durationMs}ms,{' '}
          {report.searchResults} references)
        </Text>
      </Text>
      {report.symbols.map((s) => {
        const a = s.analysis.analytics;
        const bias = a.consensusScore > 0.15 ? 'long' : a.consensusScore < -0.15 ? 'short' : 'neutral';
        return (
          <Box key={s.symbol} flexDirection="column" marginTop={1}>
            <Text>
              <Text bold>{s.symbol}</Text>{' '}
              <Text color={directionColor(bias)}>
                {bias.toUpperCase()} {a.consensusScore.toFixed(2)}
              </Text>{' '}
              <Text color={COLORS.muted}>
                ↑{a.longCount} ↓{a.shortCount} ·{a.neutralCount}
                {a.lastPrice != null ? ` @ ${a.lastPrice.toFixed(2)}` : ''}
                {a.atr != null ? ` atr ${a.atr.toFixed(2)}` : ''}
              </Text>
            </Text>
            {a.strongestStrategy ? (
              <Text color={COLORS.muted}>
                {'  '}strongest: {a.strongestStrategy} ({pct(a.strongestStrength ?? 0)})
              </Text>
            ) : null}
            <Text color={COLORS.muted}>
              {'  '}signals: +{s.signalsInserted} ~{s.signalsUpdated} ={s.signalsUnchanged} · candles +
              {s.candlesAdded}
              {s.scrapesAdded > 0 ? ` · scrapes +${s.scrapesAdded}` : ''}
            </Text>
            <Text>
              {'  '}
              <Text color={COLORS.info}>AI</Text> {s.insight}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

function StatusView({ status }: { status: StatusReport }): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={COLORS.accent}>
        ▌Status (db: {status.driver})
      </Text>
      <Text color={COLORS.muted}>
        {Object.entries(status.counts)
          .map(([k, v]) => `${k}=${v}`)
          .join('  ')}
      </Text>
      {status.latestAnalytics.map((a) => (
        <Text key={a.symbol}>
          {'  '}
          <Text bold>{a.symbol}</Text> consensus {a.consensusScore.toFixed(2)} (↑{a.longCount} ↓
          {a.shortCount})
        </Text>
      ))}
    </Box>
  );
}

function StrategiesView({ list }: { list: { id: string; title: string }[] }): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={COLORS.accent}>
        ▌{list.length} strategies
      </Text>
      {list.map((s) => (
        <Text key={s.id}>
          {'  '}
          <Text color={COLORS.info}>{s.id.padEnd(20)}</Text> {s.title}
        </Text>
      ))}
    </Box>
  );
}

/** Renders one transcript entry. */
export function OutputLine({ item }: { item: OutputItem }): React.ReactElement {
  switch (item.kind) {
    case 'banner':
      return <Banner version={item.version} driver={item.driver} model={item.model} />;
    case 'echo':
      return (
        <Text>
          <Text color={COLORS.accent}>{'> '}</Text>
          <Text color={COLORS.muted}>{item.text}</Text>
        </Text>
      );
    case 'text':
      return <Text color={item.color}>{item.text}</Text>;
    case 'error':
      return <Text color={COLORS.error}>✗ {item.text}</Text>;
    case 'run':
      return <RunView report={item.report} />;
    case 'status':
      return <StatusView status={item.status} />;
    case 'strategies':
      return <StrategiesView list={item.list} />;
  }
}
