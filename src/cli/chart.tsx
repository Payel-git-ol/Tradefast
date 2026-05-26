import { Box, Text } from 'ink';
import React from 'react';

import type { Candle } from '../domain/candle.js';
import type { CliTheme } from './theme.js';

export interface ChartData {
  symbol: string;
  interval: string;
  candles: readonly Candle[];
}

function fmt(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  if (v >= 0.0001) return v.toFixed(6);
  return v.toFixed(8);
}

export function CandleChartView({
  data,
  theme,
}: {
  data: ChartData;
  theme: CliTheme;
}): React.ReactElement {
  const { symbol, interval, candles } = data;
  if (candles.length === 0) return <></>;

  const maxCandles = 50;
  const height = 8;
  const visible = candles.slice(-maxCandles);

  const allPrices = visible.map((c) => [c.high, c.low]).flat();
  const maxPrice = Math.max(...allPrices);
  const minPrice = Math.min(...allPrices);
  const pad = maxPrice !== minPrice ? (maxPrice - minPrice) * 0.05 : maxPrice * 0.01;
  const top = maxPrice + pad;
  const bottom = Math.max(0, minPrice - pad);
  const range = top - bottom;

  const labelW = 8;

  const rows: React.ReactElement[] = [];
  for (let row = 0; row < height; row++) {
    const priceLow = top - (range * (row + 1)) / height;
    const priceHigh = top - (range * row) / height;
    const mid = (priceLow + priceHigh) / 2;

    const label = fmt(mid).padStart(labelW);

    const cells: React.ReactElement[] = [];
    for (const candle of visible) {
      const bodyTop = Math.max(candle.open, candle.close);
      const bodyBot = Math.min(candle.open, candle.close);
      const on = bodyBot <= priceHigh && bodyTop >= priceLow;
      cells.push(
        <Text key={candle.openTime} color={on ? (candle.close >= candle.open ? theme.colors.long : theme.colors.short) : undefined}>
          {on ? '█' : ' '}
        </Text>,
      );
    }

    rows.push(
      <Box key={row}>
        <Text color={theme.colors.muted}>{label} </Text>
        {cells}
      </Box>,
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.muted} paddingX={1} marginY={1}>
      <Text bold color={theme.colors.accent}>
        {' '}{symbol} · {interval} · last {visible.length} candles
      </Text>
      {rows}
    </Box>
  );
}
