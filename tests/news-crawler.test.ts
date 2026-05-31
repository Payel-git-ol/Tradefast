import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb, type DbHandle } from '../src/db/client.js';
import { TradefastStore } from '../src/db/store.js';
import {
  DEFAULT_NEWS_SOURCES,
  NewsCrawler,
  ResilientNewsPageFetcher,
  type NewsCandidate,
  type NewsFetchOptions,
  type NewsItem,
  type NewsPageFetcher,
} from '../src/services/news-crawler.js';

const ISSUE_SOURCE_URLS = [
  'https://ru.investing.com/economic-calendar',
  'https://ru.tradingview.com/economic-calendar/',
  'https://alfaforex.ru/economic-calendar/',
  'https://www.fxclub.org/economcalendar',
  'https://ru.tradingview.com/news/',
  'https://ru.investing.com/news',
  'https://www.rbc.ru/rubric/finances',
  'https://www.kommersant.ru/theme/137',
  'https://news.mail.ru/economics/',
  'https://www.litefinance.org/ru/trading/forex-news/',
  'https://ru.euronews.com/tag/markets',
  'https://ru.tradingview.com/markets/',
  'https://www.reddit.com/r/economy/',
  'https://www.reddit.com/r/Finance/',
  'https://www.reddit.com/r/stocks/',
  'https://www.reddit.com/r/investing/',
  'https://www.reddit.com/r/wallstreetbets/',
  'https://www.reddit.com/r/StockMarket/',
  'https://www.reddit.com/r/Forex/',
  'https://www.reddit.com/r/CryptoCurrency/',
  'https://www.reddit.com/r/econ/',
  'https://www.reddit.com/r/FinancialNews/',
  // Exchange-specific community sources (official blogs + key subreddits)
  'https://www.binance.com/en/blog',
  'https://www.reddit.com/r/binance/',
  'https://www.bybit.com/en/blog',
  'https://www.reddit.com/r/Bybit/',
  'https://www.okx.com/learn',
  'https://www.reddit.com/r/OKX/',
  'https://www.mexc.com/blog',
  'https://www.reddit.com/r/MEXC/',
  // Additional economic calendars
  'https://www.forexfactory.com/calendar',
  'https://www.dailyfx.com/economic-calendar',
  'https://www.myfxbook.com/forex-economic-calendar',
  // Additional global news portals
  'https://www.cnbc.com/markets/',
  'https://www.reuters.com/markets/',
  'https://www.marketwatch.com/markets',
  'https://finance.yahoo.com/',
  // Crypto-native news portals
  'https://www.coindesk.com/',
  'https://cointelegraph.com/',
  'https://www.theblock.co/latest',
  'https://decrypt.co/news',
  'https://cryptoslate.com/news/',
  'https://bitcoinmagazine.com/articles',
  'https://www.coingecko.com/en/news',
  'https://coinmarketcap.com/headlines/news/',
  // Crypto Reddit communities
  'https://www.reddit.com/r/Bitcoin/',
  'https://www.reddit.com/r/ethereum/',
  'https://www.reddit.com/r/CryptoMarkets/',
  'https://www.reddit.com/r/defi/',
  'https://www.reddit.com/r/Altcoin/',
  'https://www.reddit.com/r/CryptoTechnology/',
];

describe('news source configuration', () => {
  it('keeps the issue source list in JSON-backed crawler config', () => {
    expect(DEFAULT_NEWS_SOURCES.map((source) => source.url)).toEqual(ISSUE_SOURCE_URLS);
    expect(new Set(DEFAULT_NEWS_SOURCES.map((source) => source.id)).size).toBe(DEFAULT_NEWS_SOURCES.length);
  });
});

describe('NewsCrawler', () => {
  it('normalizes, deduplicates, and limits fetched news candidates', async () => {
    const fetcher: NewsPageFetcher = {
      name: 'fake',
      fetch: vi.fn(async (source) => ({
        pageTitle: source.title,
        candidates: [
          {
            title: '  ЦБ сохранил ставку для финансового рынка  ',
            url: '/markets/rate',
            summary: 'Первое сообщение',
            publishedAt: '2026-05-26T09:00:00.000Z',
          },
          {
            title: 'ЦБ сохранил ставку для финансового рынка',
            url: '/markets/rate',
            summary: 'Дубликат',
          },
          {
            title: 'Нефть выросла на новостях о спросе',
            url: 'https://example.test/oil#comments',
            summary: 'Второе сообщение',
          },
          {
            title: 'Меню',
            url: '/menu',
          },
        ],
      })),
      close: vi.fn(async () => {}),
    };
    const crawler = new NewsCrawler([DEFAULT_NEWS_SOURCES[0]], fetcher, {
      maxItemsPerSource: 2,
      now: () => new Date('2026-05-26T10:00:00.000Z'),
    });

    const report = await crawler.crawl();

    expect(report.items).toHaveLength(2);
    expect(report.items[0]).toMatchObject({
      sourceId: DEFAULT_NEWS_SOURCES[0].id,
      title: 'ЦБ сохранил ставку для финансового рынка',
      url: 'https://ru.investing.com/markets/rate',
      summary: 'Первое сообщение',
      publishedAt: '2026-05-26T09:00:00.000Z',
      fetchedAt: '2026-05-26T10:00:00.000Z',
    });
    expect(report.items[1].url).toBe('https://example.test/oil');
    expect(report.sources[0]).toMatchObject({ fetched: 3, accepted: 2, failed: false });
    expect(fetcher.close).toHaveBeenCalledOnce();
  });

  it('records per-source failures without aborting the full crawl', async () => {
    const fetcher: NewsPageFetcher = {
      name: 'fake',
      fetch: vi.fn(async (source) => {
        if (source.id === 'broken') throw new Error('network down');
        return { candidates: [{ title: 'Рынки ждут статистику США', url: source.url }] };
      }),
      close: vi.fn(async () => {}),
    };
    const sources = [
      { ...DEFAULT_NEWS_SOURCES[0], id: 'broken' },
      DEFAULT_NEWS_SOURCES[1],
    ];
    const crawler = new NewsCrawler(sources, fetcher, {
      now: () => new Date('2026-05-26T10:00:00.000Z'),
    });

    const report = await crawler.crawl();

    expect(report.items).toHaveLength(1);
    expect(report.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: 'broken', failed: true, error: 'network down' }),
        expect.objectContaining({ sourceId: DEFAULT_NEWS_SOURCES[1].id, failed: false, accepted: 1 }),
      ]),
    );
  });

  it('follows source-local calendar and article links up to the configured crawl depth', async () => {
    const rootUrl = 'https://ru.investing.com/economic-calendar';
    const eventUrl = 'https://ru.investing.com/economic-calendar/brc-shop-price-index-19';
    const articleUrl = 'https://ru.investing.com/analysis/article-200297782';
    const seenUrls: string[] = [];
    const pages: Record<string, NewsCandidate[]> = {
      [rootUrl]: [
        {
          title: 'BRC Shop Price Index',
          url: eventUrl,
          summary: 'Calendar event link',
        },
      ],
      [eventUrl]: [
        {
          title: 'BRC Shop Price Index in the United Kingdom',
          url: eventUrl,
          summary: 'Event detail page',
        },
        {
          title: 'Фунт ждет новые данные по потребительским ценам',
          url: articleUrl,
          summary: 'Linked Investing.com analysis article',
        },
      ],
      [articleUrl]: [
        {
          title: 'Фунт стерлингов удерживается перед публикацией индекса цен',
          url: articleUrl,
          summary: 'Full article body extracted from the detail page',
        },
      ],
    };
    const fetcher: NewsPageFetcher = {
      name: 'fake-graph',
      fetch: vi.fn(async (source) => {
        seenUrls.push(source.url);
        return { pageTitle: source.title, candidates: pages[source.url] ?? [] };
      }),
      close: vi.fn(async () => {}),
    };
    const crawler = new NewsCrawler([DEFAULT_NEWS_SOURCES[0]], fetcher, {
      maxItemsPerSource: 5,
      maxDepth: 2,
      maxPagesPerSource: 4,
      now: () => new Date('2026-05-26T10:00:00.000Z'),
    });

    const report = await crawler.crawl();

    expect(seenUrls).toEqual([rootUrl, eventUrl, articleUrl]);
    expect(report.items.map((item) => item.url)).toEqual(
      expect.arrayContaining([eventUrl, articleUrl]),
    );
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Фунт стерлингов удерживается перед публикацией индекса цен',
          url: articleUrl,
          summary: 'Full article body extracted from the detail page',
        }),
      ]),
    );
  });
});

describe('ResilientNewsPageFetcher', () => {
  const source = DEFAULT_NEWS_SOURCES[0];
  const options: NewsFetchOptions = {
    timeoutMs: 1_000,
    scrollPasses: 0,
    settleMs: 0,
    maxCandidates: 4,
  };

  it('falls back to HTTP fetching when the browser cannot be launched', async () => {
    const primary: NewsPageFetcher = {
      name: 'broken-playwright',
      fetch: vi.fn(async () => {
        throw new Error(
          "browserType.launch: Executable doesn't exist at C:\\\\ms-playwright\\\\chrome.exe",
        );
      }),
      close: vi.fn(async () => {}),
    };
    const fetcher = new ResilientNewsPageFetcher(primary);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        new Response('<html><head><title>Markets</title></head><body></body></html>', {
          headers: { 'content-type': 'text/html' },
        }),
      );

    try {
      const first = await fetcher.fetch(source, options);
      expect(first.pageTitle).toBe('Markets');
      // After the first launch failure, the primary fetcher is not retried.
      await fetcher.fetch(source, options);
      expect(primary.fetch).toHaveBeenCalledOnce();
      expect(primary.close).toHaveBeenCalledOnce();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('rethrows non-launch errors instead of masking them', async () => {
    const primary: NewsPageFetcher = {
      name: 'flaky-playwright',
      fetch: vi.fn(async () => {
        throw new Error('net::ERR_CONNECTION_REFUSED');
      }),
      close: vi.fn(async () => {}),
    };
    const fetcher = new ResilientNewsPageFetcher(primary);

    await expect(fetcher.fetch(source, options)).rejects.toThrow('net::ERR_CONNECTION_REFUSED');
    expect(primary.close).not.toHaveBeenCalled();
  });
});

describe('TradefastStore news persistence', () => {
  let handle: DbHandle;
  let store: TradefastStore;

  beforeEach(async () => {
    handle = await createDb({ dataDir: ':memory:' });
    store = new TradefastStore(handle.db);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('upserts news items by source and title for future market assessment', async () => {
    const item: NewsItem = {
      sourceId: 'rbc-finances',
      sourceTitle: 'RBC Finances',
      sourceUrl: 'https://www.rbc.ru/rubric/finances',
      kind: 'news',
      title: 'Рынок облигаций обновил максимум',
      url: 'https://www.rbc.ru/markets/bonds',
      summary: 'Первичная версия',
      fetchedAt: '2026-05-26T10:00:00.000Z',
      contentHash: 'hash-one',
    };

    await expect(store.saveNewsItem(item)).resolves.toBe('inserted');
    await expect(store.saveNewsItem(item)).resolves.toBe('unchanged');
    await expect(store.saveNewsItem({ ...item, summary: 'Обновленная версия', contentHash: 'hash-two' })).resolves.toBe(
      'updated',
    );

    const counts = await store.tableCounts();
    expect(counts.newsItems).toBe(1);
  });
});
