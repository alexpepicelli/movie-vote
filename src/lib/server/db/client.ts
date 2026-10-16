import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database, { type RunResult } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

export const MIGRATIONS_FOLDER = resolve('drizzle');

/** Opens (creating if needed) a SQLite database. Pass ':memory:' for tests. */
export function openDatabase(path: string): Db {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

	const client = new Database(path);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	client.pragma('busy_timeout = 5000');

	return drizzle(client, { schema });
}

/** The database or a transaction on it; helpers accept either. */
export type Db = BaseSQLiteDatabase<'sync', RunResult, typeof schema>;

/** The underlying better-sqlite3 connection, for things Drizzle doesn't wrap (e.g. backups). */
export const sqliteClient = (db: Db) => (db as unknown as { $client: Database.Database }).$client;

export function runMigrations(db: Db, migrationsFolder = MIGRATIONS_FOLDER) {
	migrate(db as Parameters<typeof migrate>[0], { migrationsFolder });
}
