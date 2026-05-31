import { Box, Text } from 'ink';
import React from 'react';

import { sourceGroupIds, getSourceGroup, type SourceGroupId } from '../sources.js';
import type { CliTheme } from '../theme.js';

export function PlatformSelector({
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
