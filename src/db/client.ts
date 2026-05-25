import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import * as schema from './schema.js';

/**
 * A driver-agnostic handle. Both drivers expose the identical query API, so the
 * repositories are written once against this type.
 */
export type LostfastDb = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: LostfastDb;
  /** Releases underlying resources (pool / PGlite instance). */
  close: () => Promise<void>;
  /** Which driver backs this handle. */
  driver: 'pglite' | 'postgres';
}

/** Locate the generated `drizzle/` migrations folder regardless of cwd. */
function findMigrationsFolder(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'drizzle');
    if (existsSync(join(candidate, 'meta'))) return candidate;
    dir = dirname(dir);
  }
  // Fall back to a path relative to the working directory.
  return resolve(process.cwd(), 'drizzle');
}

export interface CreateDbOptions {
  /** Postgres connection string. Falls back to DATABASE_URL, then PGlite. */
  databaseUrl?: string;
  /** PGlite data directory; use ':memory:' for an ephemeral test database. */
  dataDir?: string;
  /** Apply pending migrations on connect (default true). */
  migrate?: boolean;
}

/**
 * Open a database connection. With a Postgres URL it uses node-postgres;
 * otherwise it falls back to an embedded PGlite database (zero external deps),
 * which is ideal for local use and tests. Both speak the same SQL dialect.
 */
export async function createDb(options: CreateDbOptions = {}): Promise<DbHandle> {
  const url = options.databaseUrl ?? process.env.DATABASE_URL;
  const migrationsFolder = findMigrationsFolder();
  const shouldMigrate = options.migrate ?? true;

  if (url) {
    const pool = new pg.Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    if (shouldMigrate) await migratePg(db, { migrationsFolder });
    return { db, driver: 'postgres', close: async () => void (await pool.end()) };
  }

  const dataDir = options.dataDir ?? process.env.LOSTFAST_DATA_DIR ?? join('.lostfast', 'pgdata');
  if (dataDir !== ':memory:') {
    await mkdir(dirname(resolve(dataDir)), { recursive: true });
  }
  const client = new PGlite(dataDir === ':memory:' ? undefined : dataDir);
  const db = drizzlePglite(client, { schema }) as unknown as LostfastDb;
  if (shouldMigrate) {
    await migratePglite(db as unknown as PgliteDatabase<typeof schema>, { migrationsFolder });
  }
  return { db, driver: 'pglite', close: async () => void (await client.close()) };
}
