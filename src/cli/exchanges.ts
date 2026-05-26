export interface ExchangeInfo {
  name: string;
  label: string;
}

const EXCHANGES = {
  binance: { name: 'binance', label: 'Binance' },
  okx: { name: 'okx', label: 'OKX' },
  bybit: { name: 'bybit', label: 'Bybit' },
  mexc: { name: 'mexc', label: 'MEXC' },
} satisfies Record<string, ExchangeInfo>;

export type ExchangeName = keyof typeof EXCHANGES;

export const DEFAULT_EXCHANGE: ExchangeName = 'bybit';

export const exchangeNames = (): ExchangeName[] => Object.keys(EXCHANGES) as ExchangeName[];

export function getExchange(name?: string): ExchangeInfo {
  const normalized = (name ?? DEFAULT_EXCHANGE).toLowerCase();
  return EXCHANGES[normalized as ExchangeName] ?? EXCHANGES[DEFAULT_EXCHANGE];
}
