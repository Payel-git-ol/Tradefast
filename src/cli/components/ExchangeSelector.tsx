import { Box, Text } from 'ink';
import React from 'react';

import { getExchange, exchangeNames, type ExchangeName } from '../exchanges.js';
import type { CliTheme } from '../theme.js';

export function ExchangeSelector({
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
