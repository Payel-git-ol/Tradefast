import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from 'ink';

import { Lostfast } from './app/lostfast.js';
import { startLostfastBackend, type LostfastBackendHandle } from './backend/server.js';
import { App } from './cli/App.js';
import { renderBannerArt } from './cli/ascii.js';
import { COMMANDS, parseCommand } from './cli/commands.js';
import { getTheme, themeGradient, themeNames, type ThemeName } from './cli/theme.js';
import { getExchange, exchangeNames, type ExchangeName } from './cli/exchanges.js';
import { loadPreferences, saveTheme, saveExchange } from './cli/preferences.js';
import { renderTradeLogLines } from './cli/trade-log.js';
import { loadConfig } from './config.js';

/** Read this package's version, walking up from the module location. */
function readVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      try {
        const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string };
        if (pkg.name === 'lostfast') return pkg.version ?? '0.0.0';
      } catch {
        // keep walking
      }
    }
    dir = dirname(dir);
  }
  return '0.0.0';
}

/** Non-interactive execution for scripts, CI and Docker (`lostfast <command>`). */
async function runHeadless(command: string): Promise<number> {
  const { name, args } = parseCommand(command);
  if (name === 'unknown') {
    process.stderr.write(`Unknown command "${command}". Try: ${COMMANDS.map((c) => c.name).join(', ')}\n`);
    return 1;
  }
  if (name === 'help') {
    const gradient = themeGradient(getTheme(process.env.LOSTFAST_THEME));
    process.stdout.write(`${gradient(renderBannerArt())}\n\n`);
    for (const c of COMMANDS) process.stdout.write(`  ${c.name.padEnd(12)} ${c.summary}\n`);
    return 0;
  }
  if (name === 'theme') {
    const theme = getTheme(args[0]);
    if (args[0] && theme.name !== args[0].toLowerCase()) {
      process.stderr.write(`Unknown theme "${args[0]}". Available: ${themeNames().join(', ')}\n`);
      return 1;
    }
    if (args[0]) {
      await saveTheme(theme.name as ThemeName);
    }
    process.stdout.write(args[0] ? `Theme: ${theme.label}\n` : `Themes: ${themeNames().join(', ')}\n`);
    return 0;
  }
  if (name === 'exchange') {
    const ex = getExchange(args[0]);
    if (args[0] && ex.name !== args[0].toLowerCase()) {
      process.stderr.write(`Unknown exchange "${args[0]}". Available: ${exchangeNames().join(', ')}\n`);
      return 1;
    }
    if (args[0]) {
      await saveExchange(ex.name as ExchangeName);
    }
    process.stdout.write(args[0] ? `Exchange: ${ex.label}\n` : `Exchanges: ${exchangeNames().join(', ')}\n`);
    return 0;
  }
  if (name === 'exit') return 0;

  const config = loadConfig(name === 'api' ? { apiEnabled: true } : {});
  const app = await Lostfast.create(config);
  let backend: LostfastBackendHandle | null = null;
  try {
    if (name === 'api') {
      backend = await startLostfastBackend(app, { host: config.apiHost, port: config.apiPort });
      process.stdout.write(`GraphQL API: ${backend.url}\n`);
      await waitForShutdown();
    } else if (name === 'strategies') {
      for (const s of app.strategies()) process.stdout.write(`  ${s.id.padEnd(20)} ${s.title}\n`);
    } else if (name === 'status') {
      const status = await app.status();
      process.stdout.write(`db: ${status.driver}\n`);
      process.stdout.write(`${Object.entries(status.counts).map(([k, v]) => `${k}=${v}`).join('  ')}\n`);
    } else if (name === 'clear') {
      const pruned = await app.clear();
      process.stdout.write(`Pruned ${pruned} outdated run(s). Search table preserved.\n`);
    } else if (name === 'news') {
      const report = await app.news(reportProgress);
      const failed = report.sources.filter((source) => source.failed);
      process.stdout.write(
        `News crawl: ${report.items.length} item(s), +${report.inserted} ~${report.updated} =${report.unchanged}, ${failed.length} failed source(s).\n`,
      );
      for (const source of report.sources) {
        process.stdout.write(
          `  ${source.sourceId.padEnd(32)} ${
            source.failed ? `failed: ${source.error}` : `${source.accepted}/${source.fetched}`
          }\n`,
        );
      }
    } else {
      const runReport = await (name === 'start' ? app.start(reportProgress) : app.update(reportProgress));
      process.stdout.write(`${renderTradeLogLines(runReport).join('\n')}\n`);
    }
    return 0;
  } finally {
    if (backend) await backend.close();
    await app.close();
  }
}

/** Stream headless run progress to stderr so stdout stays parseable. */
function reportProgress(event: { message: string; step: number; totalSteps: number }): void {
  process.stderr.write(`[${event.step}/${event.totalSteps}] ${event.message}\n`);
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      process.off('SIGINT', done);
      process.off('SIGTERM', done);
      resolve();
    };
    process.once('SIGINT', done);
    process.once('SIGTERM', done);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const version = readVersion();

  if (args.length > 0) {
    process.exitCode = await runHeadless(args[0]);
    return;
  }

  const saved = await loadPreferences();
  const baseConfig = loadConfig();
  const effectiveTheme = saved.theme ?? baseConfig.theme;
  const effectiveExchange = saved.exchange ?? baseConfig.exchange;
  const config = loadConfig({ theme: effectiveTheme, exchange: effectiveExchange });
  const app = await Lostfast.create(config);
  const backend = config.apiEnabled
    ? await startLostfastBackend(app, { host: config.apiHost, port: config.apiPort })
    : null;
  try {
    const { waitUntilExit } = render(<App app={app} version={version} apiUrl={backend?.url} />);
    await waitUntilExit();
  } finally {
    if (backend) await backend.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
