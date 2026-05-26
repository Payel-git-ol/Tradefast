import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const LOG_DIR = join(process.cwd(), 'logs');

let ensured = false;

async function ensureLogDir(): Promise<void> {
  if (ensured) return;
  await mkdir(LOG_DIR, { recursive: true });
  ensured = true;
}

function ts(): string {
  return new Date().toISOString();
}

function escapeLine(v: string): string {
  return v.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

export async function logMarketData(
  symbol: string,
  source: string,
  status: 'ok' | 'error',
  detail: string,
  candles?: number,
): Promise<void> {
  try {
    await ensureLogDir();
    const file = join(LOG_DIR, 'market-data.log');
    const line = `[${ts()}] ${escapeLine(source)} | ${escapeLine(symbol)} | ${status} | ${escapeLine(detail)}${candles != null ? ` | ${candles}` : ''}\n`;
    await appendFile(file, line, 'utf8');
  } catch {
    // swallow — logging must never break the app
  }
}
