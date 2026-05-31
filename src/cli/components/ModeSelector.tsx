import { Box, Text } from 'ink';
import React from 'react';

import { getMode, modeNames, type ModeName } from '../modes.js';
import type { CliTheme } from '../theme.js';

export function ModeSelector({
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
