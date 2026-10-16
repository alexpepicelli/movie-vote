import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { Db } from './db/client';
import { movies, nights, nominations, watchlist } from './db/schema';
import type { MovieDetails, MovieSummary, SeerrClient } from './seerr';
import { SeerrError } from './seerr';
import type { RadarrClient } from './radarr';

export type MovieRow = typeof movies.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;
export const METADATA_MAX_AGE_MS = 7 * DAY_MS;
export const STATUS_MAX_AGE_MS = 5 * 60 * 1000;

export function upsertMovie(db: Db, d: MovieDetails, now = new Date()): MovieRow {
	const values = {
		title: d.title,
		year: d.year,
		overview: d.overview,
		posterPath: d.posterPath,
		backdropPath: d.backdropPath,
		runtime: d.runtime,
		genres: d.genres,
		tmdbRating: d.rating === null ? null : Math.round(d.rating * 10),
		trailerKey: d.trailerKey,
		seerrStatus: d.availability,
		metadataRefreshedAt: now
	};
	return db
		.insert(movies)
		.values({ tmdbId: d.tmdbId, ...values })
		.onConflictDoUpdate({ target: movies.tmdbId, set: values })
		.returning()
		.get();
}

/**
 * Returns a movie from the cache, fetching from Seerr when it's missing or older than 7 days.
 * If Seerr is down, a stale cached copy is returned rather than failing. Returns null if
 * Seerr says the movie doesn't exist (or isn't configured and nothing is cached).
 */
export async function getMovie(
	db: Db,
	seerr: SeerrClient | null,
	tmdbId: number,
	now = new Date()
): Promise<MovieRow | null> {
	const cached = db.select().from(movies).where(eq(movies.tmdbId, tmdbId)).get();
	const fresh =
		cached?.metadataRefreshedAt &&
		now.getTime() - cached.metadataRefreshedAt.getTime() < METADATA_MAX_AGE_MS;
	if (fresh || !seerr) return cached ?? null;

	try {
		return upsertMovie(db, await seerr.movie(tmdbId), now);
	} catch (e) {
		if (e instanceof SeerrError && e.status === 404) return null;
		if (cached) return cached;
		throw e;
	}
}

/** Updates Radarr status for the given movies (which must already be cached). */
export async function refreshStatuses(
	db: Db,
	radarr: RadarrClient,
	tmdbIds: number[],
	now = new Date()
) {
	if (tmdbIds.length === 0) return;
	const states = await radarr.states(tmdbIds);
	db.transaction((tx) => {
		for (const [tmdbId, state] of states) {
			tx.update(movies)
				.set({
					radarrStatus: state.status,
					radarrProgress: state.status === 'downloading' ? state.progress : null,
					statusRefreshedAt: now
				})
				.where(eq(movies.tmdbId, tmdbId))
				.run();
		}
	});
}

export function statusIsStale(movie: MovieRow, now = new Date()) {
	return (
		!movie.statusRefreshedAt ||
		now.getTime() - movie.statusRefreshedAt.getTime() >= STATUS_MAX_AGE_MS
	);
}

/** Movies someone cares about right now (watchlisted, or nominated in an open night) with stale status. */
export function trackedStaleMovieIds(db: Db, now = new Date()): number[] {
	const cutoff = new Date(now.getTime() - STATUS_MAX_AGE_MS);
	const stale = or(isNull(movies.statusRefreshedAt), lt(movies.statusRefreshedAt, cutoff));

	const watched = db
		.selectDistinct({ id: watchlist.tmdbId })
		.from(watchlist)
		.innerJoin(movies, eq(movies.tmdbId, watchlist.tmdbId))
		.where(stale)
		.all();
	const nominated = db
		.selectDistinct({ id: nominations.tmdbId })
		.from(nominations)
		.innerJoin(nights, eq(nights.id, nominations.nightId))
		.innerJoin(movies, eq(movies.tmdbId, nominations.tmdbId))
		.where(and(stale, inArray(nights.status, ['nominating', 'voting', 'closed'])))
		.all();

	return [...new Set([...watched, ...nominated].map((r) => r.id))];
}

/** Overlays cached Radarr state onto Seerr search results, so badges reflect downloads too. */
export function withCachedStatus(db: Db, results: MovieSummary[]) {
	const ids = results.map((r) => r.tmdbId);
	const rows = ids.length
		? db
				.select({
					tmdbId: movies.tmdbId,
					radarrStatus: movies.radarrStatus,
					radarrProgress: movies.radarrProgress
				})
				.from(movies)
				.where(inArray(movies.tmdbId, ids))
				.all()
		: [];
	const byId = new Map(rows.map((r) => [r.tmdbId, r]));
	return results.map((r) => ({
		...r,
		radarrStatus: byId.get(r.tmdbId)?.radarrStatus ?? null,
		radarrProgress: byId.get(r.tmdbId)?.radarrProgress ?? null
	}));
}
