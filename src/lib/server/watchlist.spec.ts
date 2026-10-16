import { describe, expect, it } from 'vitest';
import { testDb } from './test-db';
import { movies, nights, users } from './db/schema';
import {
	addToWatchlist,
	mostWanted,
	myWatchlist,
	removeFromWatchlist,
	wantedBy,
	watchlistIds
} from './watchlist';

function setup() {
	const db = testDb();
	const [a, b, c] = db
		.insert(users)
		.values(
			['ana', 'ben', 'cat'].map((u) => ({
				authKind: 'local' as const,
				username: u,
				displayName: u.toUpperCase()
			}))
		)
		.returning()
		.all();
	db.insert(movies)
		.values([
			{ tmdbId: 1, title: 'Alien' },
			{ tmdbId: 2, title: 'Brazil' },
			{ tmdbId: 3, title: 'Casablanca' }
		])
		.run();
	return { db, a, b, c };
}

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes));

describe('watchlist', () => {
	it('adds idempotently and removes', () => {
		const { db, a } = setup();
		addToWatchlist(db, a.id, 1);
		addToWatchlist(db, a.id, 1);
		expect([...watchlistIds(db, a.id)]).toEqual([1]);

		removeFromWatchlist(db, a.id, 1);
		expect(watchlistIds(db, a.id).size).toBe(0);
	});

	it('lists my watchlist newest first', () => {
		const { db, a } = setup();
		addToWatchlist(db, a.id, 1, at(1));
		addToWatchlist(db, a.id, 2, at(2));
		expect(myWatchlist(db, a.id).map((r) => r.movie.title)).toEqual(['Brazil', 'Alien']);
	});

	it('ranks most wanted by count, then whoever wanted it longest', () => {
		const { db, a, b, c } = setup();
		addToWatchlist(db, a.id, 3, at(1)); // Casablanca: 1 person, earliest
		addToWatchlist(db, a.id, 1, at(2)); // Alien: 2 people
		addToWatchlist(db, b.id, 1, at(3));
		addToWatchlist(db, c.id, 2, at(0)); // Brazil: 1 person, even earlier

		const ranked = mostWanted(db);
		expect(ranked.map((r) => [r.movie.title, r.wantCount])).toEqual([
			['Alien', 2],
			['Brazil', 1],
			['Casablanca', 1]
		]);
		expect(ranked[0].wantedBy.map((p) => p.displayName)).toEqual(['ANA', 'BEN']);
		expect(wantedBy(db, [2]).get(2)).toEqual([{ id: c.id, displayName: 'CAT' }]);
	});

	it('leaves out movies the group has watched, but flags them in my list', () => {
		const { db, a, b } = setup();
		addToWatchlist(db, a.id, 1);
		addToWatchlist(db, b.id, 2);
		db.insert(nights)
			.values({ title: 'Last week', status: 'watched', winnerTmdbId: 1, createdBy: a.id })
			.run();

		expect(mostWanted(db).map((r) => r.movie.tmdbId)).toEqual([2]);
		expect(myWatchlist(db, a.id)[0]).toMatchObject({ watched: true });
	});
});
