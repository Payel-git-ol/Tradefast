/**
 * Drizzle ORM schema (PostgreSQL dialect).
 *
 * The same definitions run on the embedded PGlite database (default) and on a
 * real PostgreSQL server (Docker / DATABASE_URL). Tables are grouped by the
 * five pillars of the app: market math, analytics, scraping, search and AI.
 */
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/** A pipeline execution (`/start` or `/update`). */
export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  kind: varchar('kind', { length: 16 }).notNull(), // 'start' | 'update'
  symbols: jsonb('symbols').$type<string[]>().notNull(),
  status: varchar('status', { length: 16 }).notNull().default('running'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  note: text('note'),
});

/** Raw OHLCV market data — the numeric foundation of every calculation. */
export const candles = pgTable(
  'candles',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    interval: varchar('interval', { length: 8 }).notNull(),
    openTime: timestamp('open_time', { withTimezone: true }).notNull(),
    open: doublePrecision('open').notNull(),
    high: doublePrecision('high').notNull(),
    low: doublePrecision('low').notNull(),
    close: doublePrecision('close').notNull(),
    volume: doublePrecision('volume').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('candles_symbol_interval_time_uq').on(t.symbol, t.interval, t.openTime),
  }),
);

/** Strategy outputs — the analytics math produced per run. */
export const signals = pgTable(
  'signals',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id').references(() => runs.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    strategy: varchar('strategy', { length: 40 }).notNull(),
    direction: varchar('direction', { length: 8 }).notNull(),
    strength: real('strength').notNull(),
    reason: text('reason').notNull(),
    riskPercent: real('risk_percent').notNull().default(0),
    status: varchar('status', { length: 40 }).notNull().default('evaluated'),
    quantity: doublePrecision('quantity'),
    notional: doublePrecision('notional'),
    at: timestamp('at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    bySymbol: index('signals_symbol_idx').on(t.symbol),
    uniq: uniqueIndex('signals_run_symbol_strategy_uq').on(t.runId, t.symbol, t.strategy),
  }),
);

/** Aggregated analytics per symbol per run (consensus, counts, strongest). */
export const analytics = pgTable(
  'analytics',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id').references(() => runs.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    consensusScore: real('consensus_score').notNull(),
    longCount: integer('long_count').notNull(),
    shortCount: integer('short_count').notNull(),
    neutralCount: integer('neutral_count').notNull(),
    strongestStrategy: varchar('strongest_strategy', { length: 40 }),
    strongestStrength: real('strongest_strength'),
    lastPrice: doublePrecision('last_price'),
    atr: doublePrecision('atr'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('analytics_run_symbol_uq').on(t.runId, t.symbol),
  }),
);

/** Scraping results gathered with Playwright. */
export const scrapes = pgTable(
  'scrapes',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id').references(() => runs.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 20 }),
    url: text('url').notNull(),
    title: text('title'),
    content: text('content'),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('scrapes_url_hash_uq').on(t.url, t.contentHash),
  }),
);

/** AI advisor insights derived from signals + scrapes. */
export const aiInsights = pgTable('ai_insights', {
  id: serial('id').primaryKey(),
  runId: integer('run_id').references(() => runs.id, { onDelete: 'cascade' }),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  model: varchar('model', { length: 60 }).notNull(),
  summary: text('summary').notNull(),
  confidence: real('confidence').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The "general search results table". This is the one table that survives
 * `/start` and `/clear` — it accumulates discoveries across every session.
 */
export const searchResults = pgTable(
  'search_results',
  {
    id: serial('id').primaryKey(),
    query: text('query').notNull(),
    symbol: varchar('symbol', { length: 20 }),
    source: varchar('source', { length: 40 }).notNull(),
    title: text('title').notNull(),
    url: text('url'),
    snippet: text('snippet'),
    score: real('score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('search_results_query_title_uq').on(t.query, t.title),
    byQuery: index('search_results_query_idx').on(t.query),
  }),
);

/**
 * Market and economic news collected from configured source pages. It survives
 * `/start` and `/clear`, like the general search table, so future market
 * assessment can build a durable news history.
 */
export const newsItems = pgTable(
  'news_items',
  {
    id: serial('id').primaryKey(),
    sourceId: varchar('source_id', { length: 80 }).notNull(),
    sourceTitle: text('source_title').notNull(),
    sourceUrl: text('source_url').notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    title: text('title').notNull(),
    url: text('url'),
    summary: text('summary'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    comments: text('comments'),
  },
  (t) => ({
    uniq: uniqueIndex('news_items_source_title_uq').on(t.sourceId, t.title),
    bySource: index('news_items_source_idx').on(t.sourceId),
    byFetchedAt: index('news_items_fetched_at_idx').on(t.fetchedAt),
  }),
);

/**
 * Crowd / news-driven consensus per instrument.
 * Built from the persistent news_items. Cleared on every `/start` so that the
 * "big table" of what the crawler found + what the crowd thinks is fresh.
 * Covers crypto + forex + macro events + commodities + indices.
 */
export const newsConsensus = pgTable(
  'news_consensus',
  {
    id: serial('id').primaryKey(),
    instrument: varchar('instrument', { length: 50 }).notNull(), // e.g. 'EUR/USD', 'USD', 'Gold', 'NFP', 'BTC'
    mentions: integer('mentions').notNull().default(0),
    bullish: integer('bullish').notNull().default(0),
    bearish: integer('bearish').notNull().default(0),
    neutral: integer('neutral').notNull().default(0),
    crowdBias: real('crowd_bias').notNull(), // -1.0 (very bearish) ... +1.0 (very bullish)
    lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('news_consensus_instrument_uq').on(t.instrument),
    byBias: index('news_consensus_bias_idx').on(t.crowdBias),
  }),
);

/** Tables that `/start` wipes and `/clear` prunes. The general tables are excluded. */
export const EPHEMERAL_TABLES = [signals, analytics, scrapes, aiInsights, candles, runs, newsConsensus] as const;
