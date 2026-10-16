import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { backupDue, backupName, createBackup, listBackups, pruneBackups } from './backups';

const tempDir = () => mkdtempSync(join(tmpdir(), 'votarr-backups-'));
const at = (day: number, hour = 3) => new Date(2026, 9, day, hour, 0, 0);

function fakeBackups(dir: string, dates: Date[]) {
	for (const d of dates) writeFileSync(join(dir, backupName(d)), 'x');
}

describe('backups', () => {
	it('copies the database into a readable file', async () => {
		const dir = tempDir();
		const client = new Database(':memory:');
		client.exec("create table t (v text); insert into t values ('hello')");

		const backup = await createBackup(client, dir, at(16));

		expect(backup.name).toBe('votarr-20261016-030000.db');
		const copy = new Database(join(dir, backup.name), { readonly: true });
		expect(copy.prepare('select v from t').get()).toEqual({ v: 'hello' });
		expect(listBackups(dir).map((b) => b.name)).toEqual([backup.name]);
	});

	it('lists newest first and ignores other files', () => {
		const dir = tempDir();
		fakeBackups(dir, [at(10), at(12), at(11)]);
		writeFileSync(join(dir, 'votarr-20261013-030000.db.partial'), 'x');
		writeFileSync(join(dir, 'notes.txt'), 'x');

		expect(listBackups(dir).map((b) => b.createdAt)).toEqual([at(12), at(11), at(10)]);
	});

	it('returns nothing when the folder does not exist yet', () => {
		expect(listBackups(join(tempDir(), 'missing'))).toEqual([]);
	});

	it('prunes backups older than 14 days', () => {
		const dir = tempDir();
		fakeBackups(dir, [at(1), at(2), at(4), at(16)]);

		const removed = pruneBackups(dir, at(17, 12));

		expect(removed).toEqual([backupName(at(2)), backupName(at(1))]);
		expect(listBackups(dir).map((b) => b.createdAt)).toEqual([at(16), at(4)]);
	});

	it('always keeps the newest backup, however old', () => {
		const dir = tempDir();
		fakeBackups(dir, [at(1)]);

		expect(pruneBackups(dir, at(30))).toEqual([]);
	});

	it('is due once per day', () => {
		const dir = tempDir();
		expect(backupDue(dir, at(16))).toBe(true);
		fakeBackups(dir, [at(16, 1)]);
		expect(backupDue(dir, at(16, 23))).toBe(false);
		expect(backupDue(dir, at(17, 0))).toBe(true);
	});
});
