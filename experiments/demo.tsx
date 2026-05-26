import { Box, render, Text } from 'ink';
import React from 'react';

import { OutputLine, type OutputItem } from '../src/cli/output.js';
import { suggestCommands } from '../src/cli/commands.js';
import { getTheme } from '../src/cli/theme.js';

// A static snapshot of the UI for PR screenshots.
const theme = getTheme('ocean');
const apiUrl = 'http://127.0.0.1:8787/graphql';
const input = '/stat';

const items: OutputItem[] = [
  { id: 0, kind: 'banner', version: '0.2.0', driver: 'pglite', model: 'claude-opus-4-7' },
];

function Demo(): React.ReactElement {
  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <OutputLine key={item.id} item={item} theme={theme} apiUrl={apiUrl} />
      ))}
      <Box flexDirection="column">
        <Box>
          <Text color={theme.colors.accent}>{'> '}</Text>
          <Text>{input}</Text>
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          {suggestCommands(input).map((command) => (
            <Text key={command.name}>
              <Text color={theme.colors.info}>{command.name.padEnd(12)}</Text>
              <Text color={theme.colors.muted}>{command.summary}</Text>
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

const { unmount } = render(<Demo />);
setTimeout(() => unmount(), 150);
