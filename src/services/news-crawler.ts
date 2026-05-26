import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import configuredNewsSources from '../config/news-sources.json' with { type: 'json' };

export type NewsSourceKind = 'economic-calendar' | 'news' | 'market' | 'community';

export type ExchangeCommunity = 'binance' | 'okx' | 'bybit' | 'mexc';

export interface NewsSource {
  id: string;
  title: string;
  kind: NewsSourceKind;
  url: string;
  enabled?: boolean;
  maxItems?: number;
  /** When kind==='community', indicates which exchange's community this source belongs to. */
  exchange?: ExchangeCommunity;
}

export interface NewsCandidate {
  title: string;
  url?: string;
  summary?: string;
  publishedAt?: string;
}

export interface NewsItem {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  kind: NewsSourceKind;
  title: string;
  url?: string;
  summary?: string;
  publishedAt?: string;
  fetchedAt: string;
  contentHash: string;
}

export interface NewsPageSnapshot {
  pageTitle?: string;
  candidates: NewsCandidate[];
}

export interface NewsFetchOptions {
  timeoutMs: number;
  scrollPasses: number;
  settleMs: number;
  maxCandidates: number;
}

export interface NewsPageFetcher {
  readonly name: string;
  fetch(source: NewsSource, options: NewsFetchOptions): Promise<NewsPageSnapshot>;
  close(): Promise<void>;
}

export interface NewsCrawlOptions {
  maxItemsPerSource?: number;
  maxDepth?: number;
  maxPagesPerSource?: number;
  maxLinksPerPage?: number;
  timeoutMs?: number;
  scrollPasses?: number;
  settleMs?: number;
  sourceIds?: string[];
  now?: () => Date;
}

export interface NewsCrawlProgress {
  phase: 'fetch' | 'persist' | 'done';
  sourceId?: string;
  message: string;
  step: number;
  totalSteps: number;
}

export interface NewsSourceReport {
  sourceId: string;
  title: string;
  url: string;
  fetched: number;
  accepted: number;
  failed: boolean;
  error?: string;
}

export interface NewsCrawlReport {
  sources: NewsSourceReport[];
  items: NewsItem[];
  durationMs: number;
}

export type NewsProgressListener = (event: NewsCrawlProgress) => void;

const DEFAULT_MAX_ITEMS_PER_SOURCE = 8;
const DEFAULT_MAX_DEPTH = 3;           // deeper graph following per user request (not just 1 link)
const DEFAULT_MAX_PAGES_PER_SOURCE = 20; // more aggressive page limit
const DEFAULT_MAX_LINKS_PER_PAGE = 12;   // follow many more links per page
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_SCROLL_PASSES = 2;
const DEFAULT_SETTLE_MS = 700;
const MIN_TITLE_LENGTH = 8;

const NAVIGATION_TITLES = new Set([
  'главная',
  'войти',
  'меню',
  'новости',
  'подписаться',
  'регистрация',
  'search',
  'sign in',
]);

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const DEFAULT_NEWS_SOURCES: NewsSource[] = validateNewsSources(configuredNewsSources);

export async function loadNewsSources(file = process.env.LOSTFAST_NEWS_SOURCES_FILE): Promise<NewsSource[]> {
  if (!file) return DEFAULT_NEWS_SOURCES.map((source) => ({ ...source }));
  const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown;
  return validateNewsSources(parsed);
}

export async function createNewsCrawler(): Promise<NewsCrawler> {
  const sources = await loadNewsSources();
  return new NewsCrawler(sources, new PlaywrightNewsPageFetcher(), {
    maxItemsPerSource: envNumber('LOSTFAST_NEWS_LIMIT', DEFAULT_MAX_ITEMS_PER_SOURCE),
    maxDepth: envNonNegativeInteger('LOSTFAST_NEWS_DEPTH', DEFAULT_MAX_DEPTH),
    maxPagesPerSource: envNumber('LOSTFAST_NEWS_PAGE_LIMIT', DEFAULT_MAX_PAGES_PER_SOURCE),
    maxLinksPerPage: envNumber('LOSTFAST_NEWS_LINKS_PER_PAGE', DEFAULT_MAX_LINKS_PER_PAGE),
  });
}

export class NewsCrawler {
  constructor(
    private readonly sources: readonly NewsSource[],
    private readonly fetcher: NewsPageFetcher,
    private readonly options: NewsCrawlOptions = {},
  ) {}

  async crawl(onProgress?: NewsProgressListener): Promise<NewsCrawlReport> {
    const started = Date.now();
    const activeSources = this.sources
      .filter((source) => source.enabled !== false)
      .filter((source) => !this.options.sourceIds || this.options.sourceIds.includes(source.id));
    const totalSteps = activeSources.length + 1;
    let step = 0;
    const emit = (event: Omit<NewsCrawlProgress, 'step' | 'totalSteps'>) =>
      onProgress?.({ ...event, step: ++step, totalSteps });

    const reports: NewsSourceReport[] = [];
    const items: NewsItem[] = [];

    try {
      for (const source of activeSources) {
        emit({ phase: 'fetch', sourceId: source.id, message: `Crawling ${source.title}` });
        try {
          const limit = this.maxItemsFor(source);
          const snapshot = await this.fetchSourceGraph(source, {
            timeoutMs: this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            scrollPasses: this.options.scrollPasses ?? DEFAULT_SCROLL_PASSES,
            settleMs: this.options.settleMs ?? DEFAULT_SETTLE_MS,
            maxCandidates: limit * 4,
          });
          const normalized = normalizeCandidates(source, snapshot.candidates, limit, this.now());
          items.push(...normalized.items);
          reports.push({
            sourceId: source.id,
            title: source.title,
            url: source.url,
            fetched: normalized.considered,
            accepted: normalized.items.length,
            failed: false,
          });
        } catch (error) {
          reports.push({
            sourceId: source.id,
            title: source.title,
            url: source.url,
            fetched: 0,
            accepted: 0,
            failed: true,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      await this.fetcher.close();
    }

    emit({ phase: 'done', message: `News crawl completed for ${activeSources.length} source(s)` });
    return { sources: reports, items, durationMs: Date.now() - started };
  }

  private maxItemsFor(source: NewsSource): number {
    return this.options.maxItemsPerSource ?? source.maxItems ?? DEFAULT_MAX_ITEMS_PER_SOURCE;
  }

  private async fetchSourceGraph(source: NewsSource, fetchOptions: NewsFetchOptions): Promise<NewsPageSnapshot> {
    const rootUrl = normalizeUrl(source.url, source.url) ?? source.url;
    const maxDepth = Math.max(0, Math.floor(this.options.maxDepth ?? DEFAULT_MAX_DEPTH));
    const maxPages = Math.max(1, Math.floor(this.options.maxPagesPerSource ?? DEFAULT_MAX_PAGES_PER_SOURCE));
    const maxLinksPerPage = Math.max(1, Math.floor(this.options.maxLinksPerPage ?? DEFAULT_MAX_LINKS_PER_PAGE));
    const queue: { url: string; depth: number }[] = [{ url: rootUrl, depth: 0 }];
    const queued = new Set<string>([rootUrl]);
    const visited = new Set<string>();
    const candidates: NewsCandidate[] = [];
    let pageTitle: string | undefined;

    while (queue.length > 0 && visited.size < maxPages) {
      const current = queue.shift();
      if (!current || visited.has(current.url)) continue;
      visited.add(current.url);

      try {
        const snapshot = await this.fetcher.fetch({ ...source, url: current.url }, fetchOptions);
        pageTitle ??= snapshot.pageTitle;
        const pageCandidates =
          current.depth === 0
            ? excludeCurrentPageCandidate(snapshot.candidates, rootUrl, source, snapshot.pageTitle)
            : snapshot.candidates;
        candidates.push(...pageCandidates);

        if (current.depth >= maxDepth) continue;
        for (const url of followUpUrls(source, current.url, pageCandidates, visited, maxLinksPerPage)) {
          if (visited.size + queue.length >= maxPages) break;
          if (queued.has(url)) continue;
          queued.add(url);
          queue.push({ url, depth: current.depth + 1 });
        }
      } catch (error) {
        if (current.depth === 0) throw error;
      }
    }

    return { pageTitle, candidates };
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}

export class PlaywrightNewsPageFetcher implements NewsPageFetcher {
  readonly name = 'playwright-news';
  private browser: unknown = null;

  async fetch(source: NewsSource, options: NewsFetchOptions): Promise<NewsPageSnapshot> {
    const browser = await this.ensureBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (browser as any).newPage();
    try {
      await page.setExtraHTTPHeaders({
        'accept-language': 'ru,en;q=0.9',
        'user-agent': 'LostfastNewsCrawler/0.2 (+https://github.com/Payel-git-ol/Lostfast)',
      });
      await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
      await page.waitForLoadState('networkidle', { timeout: Math.min(options.timeoutMs, 5_000) }).catch(() => {});
      for (let i = 0; i < options.scrollPasses; i++) {
        await page.evaluate(() => {
          const w = globalThis as { scrollBy?: (x: number, y: number) => void; innerHeight?: number };
          w.scrollBy?.(0, Math.max(w.innerHeight ?? 800, 400));
        });
        await page.waitForTimeout(options.settleMs);
      }
      const pageTitle: string = await page.title();
      const candidates = (await page.evaluate(extractCandidatesFromPage, {
        baseUrl: source.url,
        maxCandidates: options.maxCandidates,
      })) as NewsCandidate[];
      return { pageTitle, candidates };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (!this.browser) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.browser as any).close();
    this.browser = null;
  }

  private async ensureBrowser(): Promise<unknown> {
    if (this.browser) return this.browser;
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: true });
    return this.browser;
  }
}

function normalizeCandidates(
  source: NewsSource,
  candidates: readonly NewsCandidate[],
  limit: number,
  fetchedAt: Date,
): { items: NewsItem[]; considered: number } {
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  let considered = 0;

  for (const candidate of candidates) {
    const title = normalizeText(candidate.title);
    if (!isLikelyNewsTitle(title)) continue;
    considered++;

    const url = normalizeUrl(candidate.url, source.url);
    const key = `${url ?? ''}\n${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const summary = normalizeOptionalText(candidate.summary, 500);
    const publishedAt = normalizeDate(candidate.publishedAt);
    const item: NewsItem = {
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      kind: source.kind,
      title,
      url,
      summary: summary && summary !== title ? summary : undefined,
      publishedAt,
      fetchedAt: fetchedAt.toISOString(),
      contentHash: sha256([source.id, title, url ?? '', summary ?? '', publishedAt ?? ''].join('\n')),
    };
    items.push(item);
    if (items.length >= limit) break;
  }

  return { items, considered };
}

function extractCandidatesFromPage({
  baseUrl,
  maxCandidates,
}: {
  baseUrl: string;
  maxCandidates: number;
}): NewsCandidate[] {
  const doc = (globalThis as { document?: any }).document;
  if (!doc?.querySelectorAll) return [];
  const clean = (value: unknown): string =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  const cleanOptional = (value: unknown): string | undefined => {
    const normalized = clean(value);
    return normalized ? normalized.slice(0, 500) : undefined;
  };
  const attr = (selector: string, name: string): string =>
    clean(doc.querySelector?.(selector)?.getAttribute?.(name) ?? '');
  const firstText = (selector: string): string => clean(doc.querySelector?.(selector)?.textContent ?? '');
  const currentPageCandidate = (): NewsCandidate | undefined => {
    const title = clean(
      firstText('article h1') ||
        firstText('main h1') ||
        firstText('h1') ||
        attr('meta[property="og:title"]', 'content') ||
        attr('meta[name="twitter:title"]', 'content') ||
        doc.title,
    );
    if (!title) return undefined;

    const summary = cleanOptional(
      attr('meta[name="description"]', 'content') ||
        attr('meta[property="og:description"]', 'content') ||
        doc.querySelector?.('article, main')?.textContent ||
        doc.body?.textContent,
    );
    const timeNode = doc.querySelector?.('time[datetime], time, [datetime]');
    const publishedAt = timeNode?.getAttribute?.('datetime') ?? undefined;
    const canonical = attr('link[rel="canonical"]', 'href') || baseUrl;
    let url: string;
    try {
      url = new URL(canonical, baseUrl).toString();
    } catch {
      url = baseUrl;
    }
    return { title, url, summary, publishedAt };
  };

  const selectors = [
    'article a[href]',
    'h1 a[href]',
    'h2 a[href]',
    'h3 a[href]',
    '[class*="news" i] a[href]',
    '[class*="article" i] a[href]',
    '[class*="calendar" i] a[href]',
    '[class*="event" i] a[href]',
    'a[href]',
  ];
  const anchors: any[] = [];
  const seenNodes = new Set<any>();
  for (const selector of selectors) {
    for (const node of Array.from(doc.querySelectorAll(selector)) as any[]) {
      if (seenNodes.has(node)) continue;
      seenNodes.add(node);
      anchors.push(node);
      if (anchors.length >= maxCandidates * 3) break;
    }
    if (anchors.length >= maxCandidates * 3) break;
  }

  const out: NewsCandidate[] = [];
  const seen = new Set<string>();
  const self = currentPageCandidate();
  if (self) {
    const key = `${self.url ?? baseUrl}\n${self.title.toLowerCase()}`;
    seen.add(key);
    out.push(self);
  }
  if (out.length >= maxCandidates) return out.slice(0, maxCandidates);
  for (const anchor of anchors) {
    const href = anchor.getAttribute?.('href');
    const title = clean(anchor.textContent || anchor.getAttribute?.('aria-label') || anchor.getAttribute?.('title') || '');
    if (!href || !title) continue;
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const container =
      anchor.closest?.('article, li, tr, [class*="news" i], [class*="article" i], [class*="calendar" i], div') ??
      anchor.parentElement;
    const summary = cleanOptional(container?.textContent);
    const timeNode = container?.querySelector?.('time[datetime], time, [datetime]');
    const publishedAt = timeNode?.getAttribute?.('datetime') ?? undefined;
    const key = `${absolute}\n${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, url: absolute, summary, publishedAt });
    if (out.length >= maxCandidates) break;
  }

  return out;
}

function excludeCurrentPageCandidate(
  candidates: readonly NewsCandidate[],
  pageUrl: string,
  source: NewsSource,
  pageTitle?: string,
): NewsCandidate[] {
  const normalizedPageUrl = normalizeUrl(pageUrl, pageUrl);
  return candidates.filter((candidate) => {
    if (normalizeUrl(candidate.url, pageUrl) !== normalizedPageUrl) return true;
    const title = normalizeText(candidate.title).toLowerCase();
    if (!title) return false;
    const sourceTitle = normalizeText(source.title).toLowerCase();
    const browserTitle = normalizeText(pageTitle).toLowerCase();
    if (title === sourceTitle || title === browserTitle) return false;
    return !isGenericSourceRootTitle(source.kind, title);
  });
}

function followUpUrls(
  source: NewsSource,
  pageUrl: string,
  candidates: readonly NewsCandidate[],
  visited: ReadonlySet<string>,
  maxLinks: number,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (out.length >= maxLinks) break;
    const title = normalizeText(candidate.title);
    if (!isLikelyNewsTitle(title)) continue;
    const url = normalizeUrl(candidate.url, pageUrl);
    if (!url || seen.has(url) || visited.has(url) || url === normalizeUrl(pageUrl, pageUrl)) continue;
    if (!isSourceLocalUrl(source.url, url) || !isCrawlableSourcePath(source, url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function isSourceLocalUrl(sourceUrl: string, targetUrl: string): boolean {
  try {
    return new URL(sourceUrl).origin === new URL(targetUrl).origin;
  } catch {
    return false;
  }
}

const BLOCKED_CRAWL_PATH_PARTS = [
  '/account',
  '/accounts',
  '/advert',
  '/auth',
  '/contact',
  '/login',
  '/logout',
  '/portfolio',
  '/register',
  '/search',
  '/signup',
  '/terms',
];
const STATIC_CRAWL_PATH_RE = /\.(?:avif|css|csv|gif|ico|jpe?g|js|json|mp3|mp4|pdf|png|svg|webp|xml|zip)$/i;

function isCrawlableSourcePath(source: NewsSource, targetUrl: string): boolean {
  let path: string;
  try {
    path = new URL(targetUrl).pathname.toLowerCase();
  } catch {
    return false;
  }
  if (STATIC_CRAWL_PATH_RE.test(path)) return false;
  if (BLOCKED_CRAWL_PATH_PARTS.some((part) => path.includes(part))) return false;

  if (source.kind === 'economic-calendar') {
    return path.includes('/economic-calendar/') || path.includes('/analysis/') || path.includes('/news/');
  }

  return path.length > 1;
}

function isGenericSourceRootTitle(kind: NewsSourceKind, title: string): boolean {
  if (kind === 'economic-calendar') {
    return title === 'economic calendar' || title === 'экономический календарь' || title === 'календарь';
  }
  if (kind === 'news' || kind === 'community') {
    return title === 'news' || title === 'новости' || title === 'community' || title === 'сообщество';
  }
  return title === 'markets' || title === 'рынки';
}

function validateNewsSources(value: unknown): NewsSource[] {
  if (!Array.isArray(value)) throw new Error('News source config must be an array');
  return value.map((entry, index) => parseNewsSource(entry, index));
}

function parseNewsSource(entry: unknown, index: number): NewsSource {
  if (!isRecord(entry)) throw new Error(`News source at index ${index} must be an object`);
  const id = requireString(entry.id, `sources[${index}].id`);
  const title = requireString(entry.title, `sources[${index}].title`);
  const url = requireString(entry.url, `sources[${index}].url`);
  const kind = requireString(entry.kind, `sources[${index}].kind`);
  if (!['economic-calendar', 'news', 'market', 'community'].includes(kind)) {
    throw new Error(`sources[${index}].kind must be economic-calendar, news, market, or community`);
  }

  let exchange: ExchangeCommunity | undefined;
  if (entry.exchange != null) {
    const ex = String(entry.exchange).toLowerCase();
    if (!['binance', 'okx', 'bybit', 'mexc'].includes(ex)) {
      throw new Error(`sources[${index}].exchange must be one of binance, okx, bybit, mexc`);
    }
    exchange = ex as ExchangeCommunity;
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`sources[${index}].url must be an absolute URL`);
  }
  return {
    id,
    title,
    url,
    kind: kind as NewsSourceKind,
    enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
    maxItems: typeof entry.maxItems === 'number' && entry.maxItems > 0 ? Math.floor(entry.maxItems) : undefined,
    exchange,
  };
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLikelyNewsTitle(title: string): boolean {
  if (title.length < MIN_TITLE_LENGTH) return false;
  return !NAVIGATION_TITLES.has(title.toLowerCase());
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeOptionalText(value: unknown, maxLength: number): string | undefined {
  const normalized = normalizeText(value);
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeUrl(value: unknown, baseUrl: string): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  try {
    const url = new URL(value, baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envNonNegativeInteger(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
