/** Slash commands recognised by the interactive shell and the help listing. */
export interface CommandSpec {
  name: string;
  summary: string;
}

export const COMMANDS: CommandSpec[] = [
  { name: '/start', summary: 'Run a full analysis; clears prior run data, keeps the search table' },
  { name: '/update', summary: 'Re-analyse and persist only what changed' },
  { name: '/clear', summary: 'Prune outdated runs (the general search table is preserved)' },
  { name: '/status', summary: 'Show table counts and the latest run analytics' },
  { name: '/strategies', summary: 'List every available strategy' },
  { name: '/help', summary: 'Show this help' },
  { name: '/exit', summary: 'Quit Lostfast (aliases: /quit, Ctrl+C)' },
];

export type CommandName = 'start' | 'update' | 'clear' | 'status' | 'strategies' | 'help' | 'exit' | 'unknown';

/** Normalise raw input into a known command name. Leading slash is optional. */
export function parseCommand(raw: string): { name: CommandName; token: string } {
  const token = raw.trim().replace(/^\//, '').toLowerCase();
  switch (token) {
    case 'start':
    case 'update':
    case 'clear':
    case 'status':
    case 'strategies':
    case 'help':
      return { name: token, token };
    case 'exit':
    case 'quit':
    case 'q':
      return { name: 'exit', token };
    default:
      return { name: 'unknown', token };
  }
}
