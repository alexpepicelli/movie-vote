import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { error, fail } from '@sveltejs/kit';
import { DATABASE_URL } from '$app/env/private';
import { backupDir, KEEP_DAYS, listBackups } from '#lib/server/backups.js';
import { db } from '#lib/server/db/index.js';
import { listenerCount } from '#lib/server/events.js';
import { checkDatabase, checkService, SERVICE_CHECKS } from '#lib/server/health.js';
import { configFor } from '#lib/server/integrations.js';
import { jobStatus } from '#lib/server/jobs.js';
import { serverTimeZone } from '#lib/server/time-zone.js';
import { backUpNow } from '#lib/server/poller.js';
import type { Actions, PageServerLoad } from './$types';

const fileSize = (path: string) => {
	try {
		return statSync(path).size;
	} catch {
		return 0;
	}
};

const startedAt = new Date(Date.now() - process.uptime() * 1000);

export const load: PageServerLoad = async ({ fetch }) => {
	const [seerr, radarr] = await Promise.all(
		(['seerr', 'radarr'] as const).map((service) => {
			const { url, apiKey } = configFor(service);
			return checkService({ url, apiKey, statusPath: SERVICE_CHECKS[service] }, fetch);
		})
	);
	const dir = backupDir(DATABASE_URL);

	return {
		database: {
			check: checkDatabase(db),
			path: resolve(DATABASE_URL),
			// WAL mode keeps recent writes in a side file until they're checkpointed.
			size: fileSize(DATABASE_URL) + fileSize(`${DATABASE_URL}-wal`)
		},
		services: { seerr, radarr },
		jobs: {
			poller: jobStatus('radarr-poller'),
			scheduler: jobStatus('night-scheduler'),
			backups: jobStatus('backups')
		},
		backups: { dir: resolve(dir), keepDays: KEEP_DAYS, list: listBackups(dir) },
		liveConnections: listenerCount(),
		server: {
			startedAt,
			node: process.version,
			timeZone: serverTimeZone,
			// Set when TZ isn't a zone Node recognises and dates fall back to UTC.
			badTz:
				serverTimeZone === Intl.DateTimeFormat().resolvedOptions().timeZone
					? null
					: (process.env.TZ ?? '')
		}
	};
};

export const actions: Actions = {
	backup: async ({ locals }) => {
		if (locals.user?.role !== 'owner') error(403, 'Only the owner can make backups.');
		try {
			const backup = await backUpNow(db, backupDir(DATABASE_URL));
			return { backedUp: backup.name };
		} catch (e) {
			return fail(500, { error: `Backup failed: ${e instanceof Error ? e.message : e}` });
		}
	}
};
