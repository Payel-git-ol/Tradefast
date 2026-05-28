export interface SearchLevelInfo {
  name: string;
  label: string;
  description: string;
  maxDepth: number;
  maxPagesPerSource: number;
  maxLinksPerPage: number;
  scrollPasses: number;
  settleMs: number;
}

const SEARCH_LEVELS = {
  normal: {
    name: 'normal',
    label: 'Normal',
    description: 'Standard depth — fast, low resource usage',
    maxDepth: 2,
    maxPagesPerSource: 10,
    maxLinksPerPage: 6,
    scrollPasses: 2,
    settleMs: 700,
  },
  high: {
    name: 'high',
    label: 'High',
    description: 'Deeper crawl — more articles, comments, and links',
    maxDepth: 3,
    maxPagesPerSource: 20,
    maxLinksPerPage: 12,
    scrollPasses: 3,
    settleMs: 500,
  },
  max: {
    name: 'max',
    label: 'Max',
    description: 'Maximum extraction — every link, full comment graph, deep recursion',
    maxDepth: 5,
    maxPagesPerSource: 40,
    maxLinksPerPage: 24,
    scrollPasses: 5,
    settleMs: 300,
  },
} satisfies Record<string, SearchLevelInfo>;

export type SearchLevelName = keyof typeof SEARCH_LEVELS;

export const DEFAULT_SEARCH_LEVEL: SearchLevelName = 'normal';

export const searchLevelNames = (): SearchLevelName[] => Object.keys(SEARCH_LEVELS) as SearchLevelName[];

export function getSearchLevel(name?: string): SearchLevelInfo {
  const normalized = (name ?? DEFAULT_SEARCH_LEVEL).toLowerCase();
  return SEARCH_LEVELS[normalized as SearchLevelName] ?? SEARCH_LEVELS[DEFAULT_SEARCH_LEVEL];
}
