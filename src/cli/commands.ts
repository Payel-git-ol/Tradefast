/** Slash commands recognised by the interactive shell and the help listing. */
export interface CommandSpec {
  name: string;
  summary: string;
}

export const COMMANDS: CommandSpec[] = [
  { name: '/start', summary: 'Run a full analysis; clears prior run data, keeps the search table' },
  { name: '/update', summary: 'Re-analyse and persist only what changed' },
  { name: '/news', summary: 'Crawl configured market news and economic-calendar sources' },
  { name: '/clear', summary: 'Prune outdated runs (the general search table is preserved)' },
  { name: '/status', summary: 'Show table counts and the latest run analytics' },
  { name: '/strategies', summary: 'List every available strategy' },
  { name: '/theme', summary: 'Open the theme selector or switch CLI colour themes' },
  { name: '/exchange', summary: 'Select target exchange (Binance, OKX, Bybit, MEXC)' },
  { name: '/api', summary: 'Show the in-process GraphQL API endpoint' },
  { name: '/help', summary: 'Show this help' },
  { name: '/exit', summary: 'Quit Lostfast (aliases: /quit, Ctrl+C)' },
];

export type CommandName =
  | 'start'
  | 'update'
  | 'news'
  | 'clear'
  | 'status'
  | 'strategies'
  | 'theme'
  | 'exchange'
  | 'api'
  | 'help'
  | 'exit'
  | 'unknown';

export interface ParsedCommand {
  name: CommandName;
  token: string;
  args: string[];
}

/** Normalise raw input into a known command name. Leading slash is optional. */
export function parseCommand(raw: string): ParsedCommand {
  const [first = '', ...args] = raw.trim().split(/\s+/).filter(Boolean);
  const token = first.replace(/^\//, '').toLowerCase();
  switch (token) {
    case 'start':
    case 'update':
    case 'news':
    case 'clear':
    case 'status':
    case 'strategies':
    case 'theme':
    case 'exchange':
    case 'api':
    case 'help':
      return { name: token, token, args };
    case 'exit':
    case 'quit':
    case 'q':
      return { name: 'exit', token, args };
    default:
      return { name: 'unknown', token, args };
  }
}

function commandPrefix(raw: string): string | null {
  const trimmed = raw.trimStart();
  if (trimmed.length === 0) return null;
  const [first = '', ...rest] = trimmed.split(/\s+/);
  if (rest.length > 0) return null;
  return first.replace(/^\//, '').toLowerCase();
}

/** Commands matching the current input token. Used by the interactive shell. */
export function suggestCommands(raw: string): CommandSpec[] {
  const prefix = commandPrefix(raw);
  if (prefix == null) return [];
  return COMMANDS.filter((command) => command.name.slice(1).startsWith(prefix));
}

/** Complete the command only when the prefix has exactly one match. */
export function completeCommand(raw: string): string | null {
  const matches = suggestCommands(raw);
  return matches.length === 1 ? matches[0].name : null;
}
