/** Runtime configuration, resolved from environment variables with sane defaults. */
export interface LostfastConfig {
  symbols: string[];
  interval: string;
  candleLimit: number;
  accountBalance: number;
  model: string;
  theme: string;
  apiEnabled: boolean;
  apiHost: string;
  apiPort: number;
}

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
}

export function loadConfig(overrides: Partial<LostfastConfig> = {}): LostfastConfig {
  const symbols = (process.env.LOSTFAST_SYMBOLS ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return {
    symbols: overrides.symbols ?? (symbols.length > 0 ? symbols : DEFAULT_SYMBOLS),
    interval: overrides.interval ?? process.env.LOSTFAST_INTERVAL ?? '1h',
    candleLimit: overrides.candleLimit ?? Number(process.env.LOSTFAST_CANDLE_LIMIT ?? 200),
    accountBalance: overrides.accountBalance ?? Number(process.env.LOSTFAST_ACCOUNT_BALANCE ?? 10_000),
    model: overrides.model ?? process.env.LOSTFAST_AI_MODEL ?? 'claude-opus-4-7',
    theme: overrides.theme ?? process.env.LOSTFAST_THEME ?? 'violet',
    apiEnabled: overrides.apiEnabled ?? envFlag('LOSTFAST_API', true),
    apiHost: overrides.apiHost ?? process.env.LOSTFAST_API_HOST ?? '127.0.0.1',
    apiPort: overrides.apiPort ?? Number(process.env.LOSTFAST_API_PORT ?? 0),
  };
}
