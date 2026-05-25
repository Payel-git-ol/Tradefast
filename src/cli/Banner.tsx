import { Box, Text } from 'ink';
import React from 'react';

import { renderBannerArt } from './ascii.js';
import { brandGradient, COLORS } from './theme.js';

const ART = renderBannerArt();

export interface BannerProps {
  version: string;
  driver: string;
  model: string;
}

/**
 * The startup header, modelled on the Gemini CLI: a large gradient wordmark
 * followed by a bordered "getting started" tips panel. Pure presentation.
 */
export function Banner({ version, driver, model }: BannerProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column">
        {ART.split('\n').map((line, i) => (
          <Text key={i}>{brandGradient(line)}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={COLORS.muted}>
          Lostfast v{version} · disciplined trading analytics · db: {driver} · ai: {model}
        </Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={COLORS.accent}
        paddingX={1}
        marginTop={1}
      >
        <Text bold>Tips for getting started:</Text>
        <Text>
          1. <Text color={COLORS.info}>/start</Text> runs a full analysis (clears prior run data, keeps
          the search table).
        </Text>
        <Text>
          2. <Text color={COLORS.info}>/update</Text> re-analyses and writes only what changed.
        </Text>
        <Text>
          3. <Text color={COLORS.info}>/clear</Text> prunes outdated runs; the general search table is
          preserved.
        </Text>
        <Text>
          4. <Text color={COLORS.info}>/help</Text> lists every command, <Text color={COLORS.info}>/strategies</Text>
          lists the {''}strategies.
        </Text>
      </Box>
    </Box>
  );
}
