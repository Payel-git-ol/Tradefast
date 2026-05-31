import { Box, Text } from 'ink';
import React from 'react';

import { getInterval, intervalNames, type IntervalName } from '../intervals.js';
import type { CliTheme } from '../theme.js';

export function IntervalSelector({
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
