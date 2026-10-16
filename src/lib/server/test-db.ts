import { openDatabase, runMigrations } from './db/client';

/** A fresh, migrated in-memory database for tests. */
export function testDb() {
	const db = openDatabase(':memory:');
	runMigrations(db);
	return db;
}
