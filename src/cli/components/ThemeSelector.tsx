import { Box, Text } from 'ink';
import React from 'react';

import { getTheme, themeNames, type CliTheme } from '../theme.js';

export function ThemeSelector({
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
