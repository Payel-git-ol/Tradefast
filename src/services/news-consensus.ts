/**
 * News-driven Crowd Consensus engine.
 *
 * Extracts instruments (crypto + forex + macro + commodities + indices)
 * from the news that the crawler scrapes (especially economic calendars).
 *
 * Computes simple crowd bias (bullish / bearish / neutral) per instrument.
 * This powers the "very large table with everything the crawler found".
 *
 * Bias formula (v1):
 *   bias = (bullish - bearish) / max(1, mentions)
 *   clamped to [-1, 1]
 *
 * Trigger phrases are loaded from src/config/news-triggers.json for
 * flexible sentiment scoring (bullish, bearish, neutral categories).
 * Comments from articles can be processed the same way as titles/summaries.
 */

import type { NewsItem } from './news-crawler.js';
import triggers from '../config/news-triggers.json' with { type: 'json' };

export interface InstrumentConsensus {
  instrument: string;
  mentions: number;
  bullish: number;
  bearish: number;
  neutral: number;
  crowdBias: number; // -1 .. +1
}

const CRYPTO = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'BNB', 'AVAX', 'DOT', 'LINK',
  'LTC', 'NEAR', 'APT', 'ARB', 'SUI', 'TON', 'PEPE', 'TRX', 'ATOM', 'FIL',
  'HBAR', 'ALGO', 'VET', 'XLM', 'ETC', 'AAVE', 'ICP', 'INJ', 'RUNE', 'OP',
  'FET', 'KAS',
];

const FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'NZD', 'RUB'];

const COMMODITIES = ['Gold', 'Oil', 'Silver', 'Natural Gas', 'Copper'];

const INDICES = ['S&P 500', 'Nasdaq', 'Dow', 'S&P500', 'US500', 'US Tech 100', 'Germany 30', 'DAX', 'Nikkei'];

const MACRO_EVENTS = [
  'NFP', 'Nonfarm Payrolls', 'CPI', 'Inflation', 'Fed Rate', 'FOMC',
  'ECB Rate', 'GDP', 'Unemployment', 'Retail Sales', 'PPI', 'Interest Rate',
];

// Normalization map: raw text -> canonical instrument
const ALIASES: Record<string, string> = {
  // crypto
  bitcoin: 'BTC', btc: 'BTC',
  ethereum: 'ETH', eth: 'ETH',
  solana: 'SOL', sol: 'SOL',
  ripple: 'XRP', xrp: 'XRP',
  dogecoin: 'DOGE', doge: 'DOGE',
  tron: 'TRX', trx: 'TRX',
  cosmos: 'ATOM', atom: 'ATOM',
  filecoin: 'FIL', fil: 'FIL',
  hedera: 'HBAR', hbar: 'HBAR',
  algorand: 'ALGO', algo: 'ALGO',
  vechain: 'VET', vet: 'VET',
  stellar: 'XLM', xlm: 'XLM',
  'ethereum classic': 'ETC', etc: 'ETC',
  aave: 'AAVE',
  'internet computer': 'ICP', icp: 'ICP',
  injective: 'INJ', inj: 'INJ',
  thorchain: 'RUNE', rune: 'RUNE',
  optimism: 'OP', 'optimism token': 'OP',
  'fetch.ai': 'FET', fetch: 'FET',
  kaspa: 'KAS', kas: 'KAS',
  // forex pairs
  'eur/usd': 'EUR/USD', 'eur usd': 'EUR/USD', eurodollar: 'EUR/USD',
  'gbp/usd': 'GBP/USD', 'gbp usd': 'GBP/USD', cable: 'GBP/USD',
  'usd/jpy': 'USD/JPY', 'usd jpy': 'USD/JPY', 'usdjpy': 'USD/JPY',
  'aud/usd': 'AUD/USD', 'aud usd': 'AUD/USD',
  'usd/cad': 'USD/CAD', 'usd cad': 'USD/CAD',
  'nzd/usd': 'NZD/USD', 'nzd usd': 'NZD/USD',
  'eur/gbp': 'EUR/GBP', 'eur gbp': 'EUR/GBP',
  'eur/jpy': 'EUR/JPY', 'eur jpy': 'EUR/JPY',
  'gbp/jpy': 'GBP/JPY', 'gbp jpy': 'GBP/JPY',
  // currencies
  dollar: 'USD', 'us dollar': 'USD', usd: 'USD',
  euro: 'EUR', eur: 'EUR',
  'british pound': 'GBP', pound: 'GBP', gbp: 'GBP', 'sterling': 'GBP',
  yen: 'JPY', jpy: 'JPY',
  'australian dollar': 'AUD', aussie: 'AUD', aud: 'AUD',
  'canadian dollar': 'CAD', loonie: 'CAD', cad: 'CAD',
  'swiss franc': 'CHF', franc: 'CHF', chf: 'CHF', 'swissie': 'CHF',
  'yuan': 'CNY', cny: 'CNY',
  'new zealand dollar': 'NZD', kiwi: 'NZD', nzd: 'NZD',
  'ruble': 'RUB', rouble: 'RUB', rub: 'RUB',
  // commodities
  gold: 'Gold', xau: 'Gold',
  'crude oil': 'Oil', oil: 'Oil', wti: 'Oil', 'brent': 'Oil',
  silver: 'Silver', xag: 'Silver',
  'natural gas': 'Natural Gas', 'nat gas': 'Natural Gas',
  copper: 'Copper',
  // indices
  's&p 500': 'S&P 500', 's&p500': 'S&P 500', sp500: 'S&P 500', 'us 500': 'S&P 500', 'snp 500': 'S&P 500',
  nasdaq: 'Nasdaq', 'tech 100': 'Nasdaq', 'nasdaq 100': 'Nasdaq',
  'dow jones': 'Dow', dow: 'Dow', 'djia': 'Dow',
  dax: 'DAX', 'germany 30': 'DAX', 'de30': 'DAX',
  nikkei: 'Nikkei', 'nikkei 225': 'Nikkei', 'japan 225': 'Nikkei',
  'ftse 100': 'FTSE 100', ftse: 'FTSE 100', 'uk 100': 'FTSE 100',
  'cac 40': 'CAC 40', cac: 'CAC 40',
  's&p/tsx': 'S&P/TSX', tsx: 'S&P/TSX',
  'hang seng': 'Hang Seng', hsi: 'Hang Seng',
  'rts index': 'RTSI', rtsi: 'RTSI', 'moex': 'MOEX', 'imoex': 'MOEX',
  // macro
  'non-farm payrolls': 'NFP', nfp: 'NFP', 'non farm': 'NFP', 'payrolls': 'NFP',
  'consumer price index': 'CPI', cpi: 'CPI',
  'federal funds rate': 'Fed Rate', 'fed rate': 'Fed Rate', fomc: 'FOMC',
  'ecb rate': 'ECB Rate',
  'interest rate decision': 'Interest Rate', 'rate decision': 'Interest Rate',
  gdp: 'GDP',
  'pmi': 'PMI', 'manufacturing pmi': 'PMI', 'services pmi': 'PMI',
  'unemployment rate': 'Unemployment', unemployment: 'Unemployment',
  'retail sales': 'Retail Sales',
  'durable goods': 'Durable Goods',
};

// Load trigger phrases from the JSON dictionary
const triggerData = triggers as {
  triggers: {
    bullish: { sentiment: string[]; action: string[]; target: string[]; event: string[] };
    bearish: { sentiment: string[]; action: string[]; target: string[]; event: string[] };
    neutral: { sentiment: string[] };
  };
};

// Build flat arrays with weights per category
interface WeightedPhrase { phrase: string; weight: number }

function buildWeighted(category: Record<string, string[]>, weights: Record<string, number>): WeightedPhrase[] {
  const result: WeightedPhrase[] = [];
  for (const [sub, words] of Object.entries(category)) {
    const w = weights[sub] ?? 1;
    for (const phrase of words) result.push({ phrase, weight: w });
  }
  return result;
}

const BULLISH_PHRASES = buildWeighted(triggerData.triggers.bullish, {
  sentiment: 1, action: 1.5, target: 1.2, event: 1,
});

const BEARISH_PHRASES = buildWeighted(triggerData.triggers.bearish, {
  sentiment: 1, action: 1.5, target: 1.2, event: 1,
});

const NEUTRAL_PHRASES = buildWeighted(triggerData.triggers.neutral, {
  sentiment: 0.5,
});



/**
 * Extracts all known instruments mentioned in the given text.
 * Returns normalized canonical names (e.g. 'EUR/USD', 'NFP', 'Gold').
 */
export function extractInstruments(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();

  // Check aliases first (most specific)
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (lower.includes(alias)) {
      found.add(canonical);
    }
  }

  // Direct matches for lists
  for (const c of CRYPTO) if (lower.includes(c.toLowerCase())) found.add(c);
  for (const p of FOREX_PAIRS) if (lower.includes(p.toLowerCase())) found.add(p);
  for (const cur of CURRENCIES) if (lower.includes(cur.toLowerCase())) found.add(cur);
  for (const com of COMMODITIES) if (lower.includes(com.toLowerCase())) found.add(com);
  for (const idx of INDICES) if (lower.includes(idx.toLowerCase())) found.add(idx);
  for (const ev of MACRO_EVENTS) if (lower.includes(ev.toLowerCase())) found.add(ev);

  return Array.from(found);
}

/** Weighted sentiment scoring using the full trigger dictionary. */
export function scoreSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = text.toLowerCase();
  let bullScore = 0;
  let bearScore = 0;
  let neutralHits = 0;

  for (const { phrase, weight } of BULLISH_PHRASES) {
    if (lower.includes(phrase)) bullScore += weight;
  }
  for (const { phrase, weight } of BEARISH_PHRASES) {
    if (lower.includes(phrase)) bearScore += weight;
  }
  for (const { phrase, weight } of NEUTRAL_PHRASES) {
    if (lower.includes(phrase)) neutralHits += weight;
  }

  // If text is mostly neutral, dampen the directional signal
  if (neutralHits > bullScore + bearScore) return 'neutral';
  if (bullScore > bearScore) return 'bullish';
  if (bearScore > bullScore) return 'bearish';
  return 'neutral';
}

/**
 * Computes crowd consensus from a list of news items.
 * This is the core of the "big table".
 */
export function computeCrowdConsensus(items: NewsItem[]): InstrumentConsensus[] {
  const map = new Map<string, { mentions: number; bullish: number; bearish: number; neutral: number }>();

  for (const item of items) {
    const text = `${item.title} ${item.summary ?? ''} ${item.comments ?? ''}`;
    const instruments = extractInstruments(text);
    if (instruments.length === 0) continue;

    const sentiment = scoreSentiment(text);

    for (const inst of instruments) {
      if (!map.has(inst)) {
        map.set(inst, { mentions: 0, bullish: 0, bearish: 0, neutral: 0 });
      }
      const row = map.get(inst)!;
      row.mentions++;
      if (sentiment === 'bullish') row.bullish++;
      else if (sentiment === 'bearish') row.bearish++;
      else row.neutral++;
    }
  }

  const result: InstrumentConsensus[] = [];
  for (const [instrument, counts] of map.entries()) {
    const bias = (counts.bullish - counts.bearish) / Math.max(1, counts.mentions);
    result.push({
      instrument,
      mentions: counts.mentions,
      bullish: counts.bullish,
      bearish: counts.bearish,
      neutral: counts.neutral,
      crowdBias: Math.max(-1, Math.min(1, bias)),
    });
  }

  // Sort by |bias| * mentions (most interesting first)
  result.sort((a, b) => {
    const scoreA = Math.abs(a.crowdBias) * a.mentions;
    const scoreB = Math.abs(b.crowdBias) * b.mentions;
    return scoreB - scoreA;
  });

  return result;
}
