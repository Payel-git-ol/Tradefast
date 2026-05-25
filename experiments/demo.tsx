import { Box, render, Text } from 'ink';
import React from 'react';

import { OutputLine, type OutputItem } from '../src/cli/output.js';
import { COLORS } from '../src/cli/theme.js';
import { Lostfast } from '../src/app/lostfast.js';

// A static snapshot of the UI for the PR screenshot: banner + a real run report
// produced from deterministic synthetic data, plus the input prompt.
process.env.LOSTFAST_DATA_DIR = ':memory:';
process.env.LOSTFAST_MARKET_SOURCE = 'synthetic';
process.env.LOSTFAST_SYMBOLS = 'BTCUSDT,ETHUSDT,SOLUSDT';

const app = await Lostfast.create();
const report = await app.start();
await app.close();

const items: OutputItem[] = [
  { id: 0, kind: 'banner', version: '0.1.0', driver: 'pglite', model: 'claude-opus-4-7' },
  { id: 1, kind: 'echo', text: '/start' },
  { id: 2, kind: 'run', report },
];

function Demo(): React.ReactElement {
  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <OutputLine key={item.id} item={item} />
      ))}
      <Box>
        <Text color={COLORS.accent}>{'> '}</Text>
        <Text color={COLORS.muted}>type a command, e.g. /update  (/help for all)</Text>
      </Box>
    </Box>
  );
}

const { unmount } = render(<Demo />);
setTimeout(() => unmount(), 150);
