import type { Db } from './db/client';
import type { RadarrClient } from './radarr';
import { refreshStatuses, trackedStaleMovieIds } from './movies';

const INTERVAL_MS = 5 * 60 * 1000;

/** Refreshes Radarr status for watchlisted/nominated movies every 5 minutes. */
export function startStatusPoller(db: Db, radarr: RadarrClient | null) {
	if (!radarr) return () => {};

	let running = false;
	const tick = async () => {
		if (running) return;
		running = true;
		try {
			await refreshStatuses(db, radarr, trackedStaleMovieIds(db));
		} catch (e) {
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
