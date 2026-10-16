import { and, asc, count, desc, eq, inArray, min, notInArray } from 'drizzle-orm';
import type { Db } from './db/client';
import { movies, nights, users, watchlist } from './db/schema';

export type Person = { id: string; displayName: string };

/** The movie must already be in the cache (see getMovie). Adding twice is a no-op. */
export function addToWatchlist(db: Db, userId: string, tmdbId: number, now = new Date()) {
	db.insert(watchlist).values({ userId, tmdbId, addedAt: now }).onConflictDoNothing().run();
}

export function removeFromWatchlist(db: Db, userId: string, tmdbId: number) {
	db.delete(watchlist)
		.where(and(eq(watchlist.userId, userId), eq(watchlist.tmdbId, tmdbId)))
		.run();
}

export function watchlistIds(db: Db, userId: string): Set<number> {
	const rows = db
		.select({ id: watchlist.tmdbId })
		.from(watchlist)
		.where(eq(watchlist.userId, userId))
		.all();
	return new Set(rows.map((r) => r.id));
}

/** Movies that have been the winner of a night that was watched. */
export function watchedMovieIds(db: Db): number[] {
	return db
		.selectDistinct({ id: nights.winnerTmdbId })
		.from(nights)
		.where(eq(nights.status, 'watched'))
		.all()
		.flatMap((r) => (r.id === null ? [] : [r.id]));
}

/** A user's watchlist, newest first, with a flag for movies the group has already watched. */
export function myWatchlist(db: Db, userId: string) {
	const watched = new Set(watchedMovieIds(db));
	return db
		.select({ movie: movies, addedAt: watchlist.addedAt })
		.from(watchlist)
		.innerJoin(movies, eq(movies.tmdbId, watchlist.tmdbId))
		.where(eq(watchlist.userId, userId))
		.orderBy(desc(watchlist.addedAt), asc(movies.title))
		.all()
		.map((r) => ({ ...r, watched: watched.has(r.movie.tmdbId) }));
}

/**
 * Movies ranked by how many people have them on their watchlist (ties: wanted longest first).
 * Movies the group has already watched are left out.
 */
export function mostWanted(db: Db, limit = 50) {
	const watched = watchedMovieIds(db);
	const wantCount = count(watchlist.userId);
	const firstAdded = min(watchlist.addedAt);

	const ranked = db
		.select({ movie: movies, wantCount, firstAdded })
		.from(watchlist)
		.innerJoin(movies, eq(movies.tmdbId, watchlist.tmdbId))
		.where(watched.length ? notInArray(watchlist.tmdbId, watched) : undefined)
		.groupBy(watchlist.tmdbId)
		.orderBy(desc(wantCount), asc(firstAdded), asc(movies.title))
		.limit(limit)
		.all();

	const wanters = wantedBy(
		db,
		ranked.map((r) => r.movie.tmdbId)
	);
	return ranked.map((r) => ({
		movie: r.movie,
		wantCount: r.wantCount,
		wantedBy: wanters.get(r.movie.tmdbId) ?? []
	}));
}

/** tmdbId → people who have it on their watchlist (earliest first). */
export function wantedBy(db: Db, tmdbIds: number[]): Map<number, Person[]> {
	const result = new Map<number, Person[]>();
	if (tmdbIds.length === 0) return result;

	const rows = db
		.select({ tmdbId: watchlist.tmdbId, id: users.id, displayName: users.displayName })
		.from(watchlist)
		.innerJoin(users, eq(users.id, watchlist.userId))
		.where(inArray(watchlist.tmdbId, tmdbIds))
		.orderBy(asc(watchlist.addedAt))
		.all();
	for (const { tmdbId, ...person } of rows) {
		const list = result.get(tmdbId) ?? [];
		list.push(person);
		result.set(tmdbId, list);
	}
	return result;
}
