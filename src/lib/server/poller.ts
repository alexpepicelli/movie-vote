import type { Db } from './db/client';
import { sqliteClient } from './db/client';
import type { RadarrClient } from './radarr';
import { backupDue, createBackup, pruneBackups } from './backups';
import { recordRun } from './jobs';
import { refreshStatuses, trackedStaleMovieIds } from './movies';
import { advanceDueNights, type Transition } from './nights';

const INTERVAL_MS = 5 * 60 * 1000;

/** Refreshes Radarr status for watchlisted/nominated movies every 5 minutes. */
export function startStatusPoller(db: Db, getRadarr: () => RadarrClient | null) {
	let running = false;
	const tick = async () => {
		const radarr = getRadarr(); // re-read each time so Settings changes apply
		if (running || !radarr) return;
		running = true;
		try {
			await refreshStatuses(db, radarr, trackedStaleMovieIds(db));
			recordRun('radarr-poller');
		} catch (e) {
			recordRun('radarr-poller', e);
			console.warn('[poller] Radarr status refresh failed:', e instanceof Error ? e.message : e);
		} finally {
			running = false;
		}
	};

	const timer = setInterval(tick, INTERVAL_MS);
	timer.unref();
	void tick();
	return () => clearInterval(timer);
}

/** Checks nomination/voting deadlines every minute. */
export function startNightScheduler(db: Db, onTransition: (t: Transition) => void = () => {}) {
	const tick = () => {
		try {
			advanceDueNights(db).forEach(onTransition);
			recordRun('night-scheduler');
		} catch (e) {
			recordRun('night-scheduler', e);
			console.warn('[scheduler] Deadline check failed:', e instanceof Error ? e.message : e);
		}
	};
	const timer = setInterval(tick, 60_000);
	timer.unref();
	tick();
	return () => clearInterval(timer);
}

/** Makes one backup a day (checked hourly, so a restart or sleep doesn't skip a day). */
export function startBackupScheduler(db: Db, dir: string) {
	const tick = async () => {
		if (!backupDue(dir)) return;
		try {
			await backUpNow(db, dir);
		} catch (e) {
			console.warn('[backups] Backup failed:', e instanceof Error ? e.message : e);
		}
	};
	const timer = setInterval(tick, 60 * 60 * 1000);
	timer.unref();
	void tick();
	return () => clearInterval(timer);
}

/** Backs up and prunes, recording the result for the health page. Throws on failure. */
export async function backUpNow(db: Db, dir: string) {
	try {
		const backup = await createBackup(sqliteClient(db), dir);
		pruneBackups(dir);
		recordRun('backups');
		return backup;
	} catch (e) {
		recordRun('backups', e);
		throw e;
	}
}
