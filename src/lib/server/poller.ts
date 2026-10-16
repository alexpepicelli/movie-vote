import type { Db } from './db/client';
import type { RadarrClient } from './radarr';
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

/** Checks nomination/voting deadlines every minute. */
export function startNightScheduler(db: Db, onTransition: (t: Transition) => void = () => {}) {
	const tick = () => {
		try {
			advanceDueNights(db).forEach(onTransition);
		} catch (e) {
			console.warn('[scheduler] Deadline check failed:', e instanceof Error ? e.message : e);
		}
	};
	const timer = setInterval(tick, 60_000);
	timer.unref();
	tick();
	return () => clearInterval(timer);
}
