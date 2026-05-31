import { Text } from 'ink';
import type React from 'react';

import type { CliTheme } from './theme.js';

export type AiMarkupTone = 'positive' | 'negative';

export interface AiMarkupSegment {
  text: string;
  bold?: boolean;
  code?: boolean;
  tone?: AiMarkupTone;
}

type SegmentStyle = Omit<AiMarkupSegment, 'text'>;

const SIGNED_NUMBER = /(^|[^\w.+-])([+-](?:\d+(?:\.\d+)?|\.\d+)%?)(?=$|[^\w.])/g;

function sameStyle(a: AiMarkupSegment, b: SegmentStyle): boolean {
  return a.bold === b.bold && a.code === b.code && a.tone === b.tone;
}

function pushSegment(segments: AiMarkupSegment[], text: string, style: SegmentStyle = {}): void {
  if (text.length === 0) return;
  const last = segments[segments.length - 1];
  if (last && sameStyle(last, style)) {
    last.text += text;
    return;
  }
  segments.push({ text, ...style });
}

function pushTextWithSignedNumbers(segments: AiMarkupSegment[], text: string, style: SegmentStyle): void {
  SIGNED_NUMBER.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = SIGNED_NUMBER.exec(text)) !== null) {
    const prefix = match[1] ?? '';
    const value = match[2] ?? '';
    const valueStart = match.index + prefix.length;
    const valueEnd = valueStart + value.length;

    pushSegment(segments, text.slice(cursor, valueStart), style);
    pushSegment(segments, value, {
      ...style,
      tone: value.startsWith('+') ? 'positive' : 'negative',
    });
    cursor = valueEnd;
  }

  pushSegment(segments, text.slice(cursor), style);
}

function parseInline(text: string, style: SegmentStyle = {}): AiMarkupSegment[] {
  const segments: AiMarkupSegment[] = [];
  let cursor = 0;

  const pushPlain = (end: number) => {
    pushTextWithSignedNumbers(segments, text.slice(cursor, end), style);
    cursor = end;
  };

  while (cursor < text.length) {
    const boldStart = text.indexOf('**', cursor);
    const codeStart = text.indexOf('`', cursor);
    const candidates = [boldStart, codeStart].filter((index) => index >= 0);
    const next = candidates.length === 0 ? -1 : Math.min(...candidates);

    if (next < 0) {
      pushPlain(text.length);
      break;
    }

    if (next > cursor) pushPlain(next);

    if (text.startsWith('**', cursor)) {
      const end = text.indexOf('**', cursor + 2);
      if (end < 0) {
        pushPlain(text.length);
        break;
      }
      pushTextWithSignedNumbers(segments, text.slice(cursor + 2, end), { ...style, bold: true });
      cursor = end + 2;
      continue;
    }

    const end = text.indexOf('`', cursor + 1);
    if (end < 0) {
      pushPlain(text.length);
      break;
    }
    pushSegment(segments, text.slice(cursor + 1, end), { ...style, code: true });
    cursor = end + 1;
  }

  return segments;
}

export function parseAiMarkup(text: string): AiMarkupSegment[] {
  const segments: AiMarkupSegment[] = [];
  const lines = text.split('\n');
  let inCodeFence = false;

  lines.forEach((line, index) => {
    const newline = index < lines.length - 1 ? '\n' : '';
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      return;
    }

    if (inCodeFence) {
      pushSegment(segments, `${line}${newline}`, { code: true });
      return;
    }

    for (const segment of parseInline(`${line}${newline}`)) {
      const { text: segmentText, ...segmentStyle } = segment;
      pushSegment(segments, segmentText, segmentStyle);
    }
  });

  return segments;
}

function segmentColor(segment: AiMarkupSegment, theme: CliTheme): string | undefined {
  if (segment.tone === 'positive') return theme.colors.long;
  if (segment.tone === 'negative') return theme.colors.short;
  if (segment.code) return theme.colors.info;
  return undefined;
}

export function AiFormattedText({ text, theme }: { text: string; theme: CliTheme }): React.ReactElement {
  return (
    <Text color={theme.colors.muted}>
      {parseAiMarkup(text).map((segment, index) => (
        <Text key={`${index}:${segment.text}`} bold={segment.bold} color={segmentColor(segment, theme)}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
