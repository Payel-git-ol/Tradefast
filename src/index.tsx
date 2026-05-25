import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from 'ink';

import { Lostfast } from './app/lostfast.js';
import { App } from './cli/App.js';
import { renderBannerArt } from './cli/ascii.js';
import { COMMANDS, parseCommand } from './cli/commands.js';
import { brandGradient } from './cli/theme.js';

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
  const { name } = parseCommand(command);
  if (name === 'unknown') {
    process.stderr.write(`Unknown command "${command}". Try: ${COMMANDS.map((c) => c.name).join(', ')}\n`);
    return 1;
  }
  if (name === 'help') {
    process.stdout.write(`${brandGradient(renderBannerArt())}\n\n`);
    for (const c of COMMANDS) process.stdout.write(`  ${c.name.padEnd(12)} ${c.summary}\n`);
    return 0;
  }
  if (name === 'exit') return 0;

  const app = await Lostfast.create();
  try {
    if (name === 'strategies') {
      for (const s of app.strategies()) process.stdout.write(`  ${s.id.padEnd(20)} ${s.title}\n`);
    } else if (name === 'status') {
      const status = await app.status();
      process.stdout.write(`db: ${status.driver}\n`);
      process.stdout.write(`${Object.entries(status.counts).map(([k, v]) => `${k}=${v}`).join('  ')}\n`);
    } else if (name === 'clear') {
      const pruned = await app.clear();
      process.stdout.write(`Pruned ${pruned} outdated run(s). Search table preserved.\n`);
    } else {
      const runReport = await (name === 'start' ? app.start(reportProgress) : app.update(reportProgress));
      for (const s of runReport.symbols) {
        const a = s.analysis.analytics;
        process.stdout.write(
          `${s.symbol}: consensus ${a.consensusScore.toFixed(2)} (↑${a.longCount} ↓${a.shortCount}) — ${s.insight}\n`,
        );
      }
      process.stdout.write(`Run #${runReport.runId} (${runReport.kind}) completed in ${runReport.durationMs}ms.\n`);
    }
    return 0;
  } finally {
    await app.close();
  }
}

/** Stream headless run progress to stderr so stdout stays parseable. */
function reportProgress(event: { message: string; step: number; totalSteps: number }): void {
  process.stderr.write(`[${event.step}/${event.totalSteps}] ${event.message}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const version = readVersion();

  if (args.length > 0) {
    process.exitCode = await runHeadless(args[0]);
    return;
  }

  const app = await Lostfast.create();
  const { waitUntilExit } = render(<App app={app} version={version} />);
  await waitUntilExit();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
