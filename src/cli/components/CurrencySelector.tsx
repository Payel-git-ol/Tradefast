import { Box, Text } from 'ink';
import React from 'react';

import type { CliTheme } from '../theme.js';

export function CurrencySelector({
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
