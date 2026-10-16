import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';

export const KEEP_DAYS = 14;

const NAME = /^votarr-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.db$/;

export type Backup = { name: string; size: number; createdAt: Date };

/** Backups live next to the database: /config/backups in Docker. */
export const backupDir = (databasePath: string) => join(dirname(databasePath), 'backups');

const pad = (n: number) => String(n).padStart(2, '0');

/** votarr-20261016-031500.db, in server-local time (TZ) so it matches what the owner sees. */
export const backupName = (d: Date) =>
	`votarr-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.db`;

/** Newest first. Ignores anything that isn't a finished Votarr backup. */
export function listBackups(dir: string): Backup[] {
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return [];
	}
	return names
		.flatMap((name) => {
			const m = NAME.exec(name);
			if (!m) return [];
			const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
			return [
				{
					name,
					size: statSync(join(dir, name)).size,
					createdAt: new Date(y, mo - 1, d, h, mi, s)
				}
			];
		})
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Copies the live database with SQLite's online backup, so it's consistent even mid-write.
 * Writes to a temp name first so a half-finished file never looks like a backup.
 */
export async function createBackup(
	client: Database.Database,
	dir: string,
	now = new Date()
): Promise<Backup> {
	mkdirSync(dir, { recursive: true });
	const name = backupName(now);
	const temp = join(dir, `${name}.partial`);
	try {
		await client.backup(temp);
		renameSync(temp, join(dir, name));
	} finally {
		rmSync(temp, { force: true });
	}
	return { name, size: statSync(join(dir, name)).size, createdAt: now };
}

/** Deletes backups older than `keepDays`, but always keeps the newest one. Returns what it removed. */
export function pruneBackups(dir: string, now = new Date(), keepDays = KEEP_DAYS): string[] {
	const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
	const old = listBackups(dir)
		.slice(1)
		.filter((b) => b.createdAt.getTime() < cutoff);
	for (const b of old) rmSync(join(dir, b.name), { force: true });
	return old.map((b) => b.name);
}

const sameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

/** True when there's no backup from today yet (server-local date). */
export const backupDue = (dir: string, now = new Date()) =>
	!listBackups(dir).some((b) => sameDay(b.createdAt, now));
