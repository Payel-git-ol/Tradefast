import { Box, Text } from 'ink';
import React from 'react';

import type { PersistedNewsCrawlReport, StatusReport } from '../app/lostfast.js';
import type { RunReport } from '../pipeline/collector.js';
import { Banner } from './Banner.js';
import { type CliTheme } from './theme.js';
import { renderTradeLogLines } from './trade-log.js';

/** A single entry in the scrolling transcript. */
export type OutputItem =
  | { id: number; kind: 'banner'; version: string; driver: string; model: string }
  | { id: number; kind: 'echo'; text: string }
  | { id: number; kind: 'text'; text: string; color?: string }
  | { id: number; kind: 'error'; text: string }
  | { id: number; kind: 'run'; report: RunReport }
  | { id: number; kind: 'news'; report: PersistedNewsCrawlReport }
  | { id: number; kind: 'status'; status: StatusReport }
  | { id: number; kind: 'strategies'; list: { id: string; title: string }[] };

function RunView({ report, theme }: { report: RunReport; theme: CliTheme }): React.ReactElement {
  const lines = renderTradeLogLines(report);

  return (
    <Box flexDirection="column" marginY={1}>
      {lines.map((line, index) => (
        <Text
          key={`${index}:${line}`}
          bold={index === 0 || index === 2}
          color={index === 0 ? theme.colors.accent : index === 3 ? theme.colors.muted : undefined}
        >
          {line}
        </Text>
      ))}
    </Box>
  );
}

function NewsView({ report, theme }: { report: PersistedNewsCrawlReport; theme: CliTheme }): React.ReactElement {
  const failed = report.sources.filter((source) => source.failed);
  return (
    <Box flexDirection="column" marginY={1}>
      <Text>
        <Text color={theme.colors.accent} bold>
          ▌News crawl
        </Text>{' '}
        <Text color={theme.colors.muted}>
          ({report.sources.length} source(s), {report.items.length} item(s), {report.durationMs}ms)
        </Text>
      </Text>
      <Text color={theme.colors.muted}>
        {'  '}news items: +{report.inserted} ~{report.updated} ={report.unchanged}
      </Text>
      {report.sources.slice(0, 8).map((source) => (
        <Text key={source.sourceId} color={source.failed ? theme.colors.error : theme.colors.muted}>
          {'  '}
          {source.sourceId.padEnd(32)} {source.failed ? `failed: ${source.error}` : `${source.accepted}/${source.fetched}`}
        </Text>
      ))}
      {report.sources.length > 8 ? (
        <Text color={theme.colors.muted}>{'  '}...{report.sources.length - 8} more source(s)</Text>
      ) : null}
      {failed.length > 0 ? (
        <Text color={theme.colors.error}>{'  '}failed sources: {failed.map((source) => source.sourceId).join(', ')}</Text>
      ) : null}
    </Box>
  );
}

function StatusView({ status, theme }: { status: StatusReport; theme: CliTheme }): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={theme.colors.accent}>
        ▌Status (db: {status.driver})
      </Text>
      <Text color={theme.colors.muted}>
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

function StrategiesView({
  list,
  theme,
}: {
  list: { id: string; title: string }[];
  theme: CliTheme;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={theme.colors.accent}>
        ▌{list.length} strategies
      </Text>
      {list.map((s) => (
        <Text key={s.id}>
          {'  '}
          <Text color={theme.colors.info}>{s.id.padEnd(20)}</Text> {s.title}
        </Text>
      ))}
    </Box>
  );
}

/** Renders one transcript entry. */
export function OutputLine({
  item,
  theme,
  apiUrl,
}: {
  item: OutputItem;
  theme: CliTheme;
  apiUrl?: string;
}): React.ReactElement {
  switch (item.kind) {
    case 'banner':
      return <Banner version={item.version} driver={item.driver} model={item.model} theme={theme} apiUrl={apiUrl} />;
    case 'echo':
      return (
        <Text>
          <Text color={theme.colors.accent}>{'> '}</Text>
          <Text color={theme.colors.muted}>{item.text}</Text>
        </Text>
      );
    case 'text':
      return <Text color={item.color}>{item.text}</Text>;
    case 'error':
      return <Text color={theme.colors.error}>✗ {item.text}</Text>;
    case 'run':
      return <RunView report={item.report} theme={theme} />;
    case 'news':
      return <NewsView report={item.report} theme={theme} />;
    case 'status':
      return <StatusView status={item.status} theme={theme} />;
    case 'strategies':
      return <StrategiesView list={item.list} theme={theme} />;
  }
}
