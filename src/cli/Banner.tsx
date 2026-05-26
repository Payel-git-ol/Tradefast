import { Box, Text } from 'ink';
import React from 'react';

import { renderBannerArt } from './ascii.js';
import { type CliTheme, themeGradient } from './theme.js';

const ART = renderBannerArt();

export interface BannerProps {
  version: string;
  driver: string;
  model: string;
  theme: CliTheme;
  apiUrl?: string;
}

/**
 * The startup header, modelled on the Gemini CLI: a large gradient wordmark
 * followed by a bordered "getting started" tips panel. Pure presentation.
 */
export function Banner({ version, driver, model, theme, apiUrl }: BannerProps): React.ReactElement {
  const gradient = themeGradient(theme);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column">
        {ART.split('\n').map((line, i) => (
          <Text key={i}>{gradient(line)}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          Lostfast v{version} · disciplined trading analytics · db: {driver} · ai: {model} · api:{' '}
          {apiUrl ?? 'off'}
        </Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        paddingX={1}
        marginTop={1}
      >
        <Text bold color={theme.colors.text}>Tips for getting started:</Text>
        <Text>
          1. <Text color={theme.colors.info}>/start</Text> runs a full analysis (clears prior run data, keeps
          the search table).
        </Text>
        <Text>
          2. <Text color={theme.colors.info}>/update</Text> re-analyses and writes only what changed.
        </Text>
        <Text>
          3. <Text color={theme.colors.info}>/clear</Text> prunes outdated runs; the general search table is
          preserved.
        </Text>
        <Text>
          4. <Text color={theme.colors.info}>/help</Text> lists every command;{' '}
          <Text color={theme.colors.info}>/strategies</Text> lists the strategies.
        </Text>
      </Box>
    </Box>
  );
}
