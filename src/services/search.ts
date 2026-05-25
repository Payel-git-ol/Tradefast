export interface SearchResult {
  query: string;
  symbol?: string;
  source: string;
  title: string;
  url?: string;
  snippet?: string;
  score: number;
}

interface KnowledgeEntry {
  title: string;
  url: string;
  snippet: string;
  /** Lowercase keywords used for relevance scoring. */
  keywords: string[];
}

/**
 * A curated, offline knowledge base of trading-strategy and market references.
 * It lets the CLI work with zero network access while still populating the
 * general `search_results` table with relevant, deterministic entries. A real
 * web backend can be slotted in behind the same {@link SearchProvider}
 * interface without touching callers.
 */
const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    title: 'Trend Following with Moving Averages',
    url: 'https://www.investopedia.com/terms/t/trendtrading.asp',
    snippet: 'Riding sustained directional moves using fast/slow moving-average crossovers and slope.',
    keywords: ['trend', 'following', 'moving', 'average', 'ema', 'sma', 'momentum'],
  },
  {
    title: 'Mean Reversion and the RSI',
    url: 'https://www.investopedia.com/terms/m/meanreversion.asp',
    snippet: 'Fading overbought/oversold extremes back toward a statistical mean using RSI and z-scores.',
    keywords: ['mean', 'reversion', 'rsi', 'oversold', 'overbought', 'bollinger'],
  },
  {
    title: 'Breakout Trading and Donchian Channels',
    url: 'https://www.investopedia.com/terms/b/breakout.asp',
    snippet: 'Entering as price clears a defined range high/low, confirmed by volume and channel width.',
    keywords: ['breakout', 'donchian', 'channel', 'range', 'volume', 'volatility'],
  },
  {
    title: 'Bollinger Band Squeeze',
    url: 'https://www.investopedia.com/articles/technical/04/030304.asp',
    snippet: 'Low-volatility contraction (narrow bands) preceding an expansion and directional move.',
    keywords: ['bollinger', 'squeeze', 'volatility', 'bandwidth', 'breakout'],
  },
  {
    title: 'MACD Momentum Crossovers',
    url: 'https://www.investopedia.com/terms/m/macd.asp',
    snippet: 'Signal-line crossovers and histogram expansion as a momentum confirmation tool.',
    keywords: ['macd', 'momentum', 'crossover', 'histogram', 'ema'],
  },
  {
    title: 'Stochastic Oscillator Reversals',
    url: 'https://www.investopedia.com/terms/s/stochasticoscillator.asp',
    snippet: '%K/%D crosses in overbought/oversold zones used to time mean-reverting entries.',
    keywords: ['stochastic', 'oscillator', 'reversal', 'overbought', 'oversold'],
  },
  {
    title: 'VWAP as Intraday Fair Value',
    url: 'https://www.investopedia.com/terms/v/vwap.asp',
    snippet: 'Volume-weighted average price as a reversion anchor and execution benchmark.',
    keywords: ['vwap', 'volume', 'reversion', 'intraday', 'fair', 'value'],
  },
  {
    title: 'Support and Resistance Zones',
    url: 'https://www.investopedia.com/trading/support-and-resistance-basics/',
    snippet: 'Reaction levels where supply/demand cluster; bounces and breaks define the bias.',
    keywords: ['support', 'resistance', 'level', 'zone', 'pullback'],
  },
  {
    title: 'Smart Money Concepts and Order Flow',
    url: 'https://www.investopedia.com/terms/s/smart-money.asp',
    snippet: 'Tracking institutional positioning via liquidity, structure shifts and volume imbalances.',
    keywords: ['smart', 'money', 'institutional', 'order', 'flow', 'liquidity', 'volume'],
  },
  {
    title: 'Position Sizing and the 2% Risk Rule',
    url: 'https://www.investopedia.com/articles/trading/09/risk-management.asp',
    snippet: 'Sizing positions so a stop-out risks a fixed fraction of equity — the core of survival.',
    keywords: ['risk', 'position', 'sizing', 'stop', 'atr', 'management'],
  },
  {
    title: 'Average True Range for Volatility-Based Stops',
    url: 'https://www.investopedia.com/terms/a/atr.asp',
    snippet: 'Using ATR to place stops and size positions proportional to market volatility.',
    keywords: ['atr', 'volatility', 'stop', 'risk', 'range'],
  },
  {
    title: 'Grid Trading in Ranging Markets',
    url: 'https://www.investopedia.com/terms/g/grid-trading.asp',
    snippet: 'Laddering orders around a reference price to harvest oscillation in sideways regimes.',
    keywords: ['grid', 'range', 'ladder', 'sideways', 'reversion'],
  },
];

export interface SearchProvider {
  readonly name: string;
  search(query: string, symbol?: string): Promise<SearchResult[]>;
}

/** Ranks the offline knowledge base against a query using keyword overlap. */
export class KnowledgeBaseSearch implements SearchProvider {
  readonly name = 'knowledge-base';
  constructor(private readonly entries: KnowledgeEntry[] = KNOWLEDGE_BASE) {}

  async search(query: string, symbol?: string): Promise<SearchResult[]> {
    const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const ranked = this.entries
      .map((entry) => ({ entry, score: relevance(entry, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return ranked.map(({ entry, score }) => ({
      query,
      symbol,
      source: this.name,
      title: entry.title,
      url: entry.url,
      snippet: entry.snippet,
      score: Number(score.toFixed(3)),
    }));
  }
}

/** Normalised keyword-overlap relevance in the range [0, 1]. */
function relevance(entry: KnowledgeEntry, terms: string[]): number {
  if (terms.length === 0) return 0;
  const haystack = new Set([...entry.keywords, ...entry.title.toLowerCase().split(/[^a-z0-9]+/)]);
  let hits = 0;
  for (const term of terms) {
    if (haystack.has(term)) hits++;
  }
  return hits / terms.length;
}
