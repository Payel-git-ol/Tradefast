import { Box, Text } from 'ink';
import React from 'react';

import type { PersistedNewsCrawlReport, StatusReport } from '../app/lostfast.js';
import type { RunReport } from '../pipeline/collector.js';
import type { BacktestReport } from '../services/backtest.js';
import { Banner } from './Banner.js';
import { renderBacktestParts } from './backtest-log.js';
import type { ChartData } from './chart.js';
import { CandleChartView } from './chart.js';
import { directionColor, type CliTheme } from './theme.js';
import { renderTradeLogParts } from './trade-log.js';

/** A single entry in the scrolling transcript. */
export type OutputItem =
  | { id: number; kind: 'banner'; version: string; driver: string; model: string }
  | { id: number; kind: 'echo'; text: string }
  | { id: number; kind: 'text'; text: string; color?: string }
  | { id: number; kind: 'error'; text: string }
  | { id: number; kind: 'run'; report: RunReport }
  | { id: number; kind: 'backtest'; report: BacktestReport }
  | { id: number; kind: 'news'; report: PersistedNewsCrawlReport }
  | { id: number; kind: 'status'; status: StatusReport }
  | { id: number; kind: 'strategies'; list: { id: string; title: string }[] }
  | { id: number; kind: 'chart'; data: ChartData };

function RunView({ report, theme }: { report: RunReport; theme: CliTheme }): React.ReactElement {
  const parts = renderTradeLogParts(report);

  return (
    <Box flexDirection="column" marginY={1}>
      {parts.map((part, index) => {
        if ('text' in part) {
          return (
            <Text
              key={`${index}:${part.text}`}
              bold={part.kind === 'title'}
              color={part.kind === 'title' ? theme.colors.accent : theme.colors.muted}
            >
              {part.text}
            </Text>
          );
        }

        return (
          <Text key={`${index}:${part.kind}`} bold={part.kind === 'header'}>
            <Text color={theme.colors.muted}>│</Text>
            {part.cells.map((cell) => (
              <React.Fragment key={cell.key}>
                <Text
                  color={part.kind === 'row' && cell.key === 'direction' ? directionColor(cell.value, theme) : undefined}
                >
                  {cell.text}
                </Text>
                <Text color={theme.colors.muted}>│</Text>
              </React.Fragment>
            ))}
          </Text>
        );
      })}

      {report.validation && (
        <Box marginTop={1}>
          {report.validation.corrections.length > 0 ? (
            <Text color={theme.colors.muted}>
              {'  '}AI: {report.validation.summary}
            </Text>
          ) : (
            <Text color={theme.colors.error}>
              {'  '}AI Error: {report.validation.raw}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Green for a positive edge, red for a negative one, muted for break-even. */
function edgeColor(value: string, theme: CliTheme): string {
  if (value.startsWith('-')) return theme.colors.short;
  if (value.startsWith('+') && Number.parseFloat(value) !== 0) return theme.colors.long;
  return theme.colors.muted;
}

function BacktestView({ report, theme }: { report: BacktestReport; theme: CliTheme }): React.ReactElement {
  const parts = renderBacktestParts(report);

  return (
    <Box flexDirection="column" marginY={1}>
      {parts.map((part, index) => {
        if ('text' in part) {
          return (
            <Text
              key={`${index}:${part.text}`}
              bold={part.kind === 'title'}
              color={part.kind === 'title' ? theme.colors.accent : theme.colors.muted}
            >
              {part.text}
            </Text>
          );
        }

        const emphasise = part.kind === 'header' || part.kind === 'total';
        return (
          <Text key={`${index}:${part.kind}`} bold={emphasise}>
            <Text color={theme.colors.muted}>│</Text>
            {part.cells.map((cell) => (
              <React.Fragment key={cell.key}>
                <Text color={part.kind === 'row' && cell.key === 'expectancy' ? edgeColor(cell.value, theme) : undefined}>
                  {cell.text}
                </Text>
                <Text color={theme.colors.muted}>│</Text>
              </React.Fragment>
            ))}
          </Text>
        );
      })}
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
  const crowd = status.crowdConsensus ?? [];
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

      {crowd.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.colors.accent}>
            ▌News Crowd Consensus ({crowd.length} instruments — forex • macro • crypto • everything the crawler found)
          </Text>
          {crowd.slice(0, 25).map((c, idx) => {
            const dir = c.crowdBias > 0.15 ? 'bullish' : c.crowdBias < -0.15 ? 'bearish' : 'neutral';
            const color = dir === 'bullish' ? theme.colors.long : dir === 'bearish' ? theme.colors.short : theme.colors.muted;
            return (
              <Text key={idx}>
                {'  '}
                <Text bold>{c.instrument.padEnd(12)}</Text>{' '}
                <Text color={color}>{dir.padEnd(8)}</Text>
                bias {c.crowdBias.toFixed(2)} ({c.mentions} mentions: +{c.bullish} -{c.bearish})
              </Text>
            );
          })}
          {crowd.length > 25 && (
            <Text color={theme.colors.muted}>  ... +{crowd.length - 25} more instruments in the full crowd table</Text>
          )}
        </Box>
      )}
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
    case 'backtest':
      return <BacktestView report={item.report} theme={theme} />;
    case 'news':
      return <NewsView report={item.report} theme={theme} />;
    case 'status':
      return <StatusView status={item.status} theme={theme} />;
    case 'strategies':
      return <StrategiesView list={item.list} theme={theme} />;
    case 'chart':
      return <CandleChartView data={item.data} theme={theme} />;
  }
}
