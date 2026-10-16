import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './test-db';
import { auditLog, movies, nominations, users } from './db/schema';
import {
	castVote,
	closeVoting,
	createNight,
	currentNight,
	getNight,
	markWatched,
	nightRatings,
	nominate,
	pastNights,
	rate,
	ratingPrompt,
	startVoting
} from './nights';
import { requestMovie } from './requests';
import { SeerrClient } from './seerr';
import { mostWanted } from './watchlist';
import { addToWatchlist } from './watchlist';

const DAY = 24 * 3600_000;
const now = new Date('2026-10-20T09:00:00Z');

/** A night that's been through voting, won by movie 1. */
function closedNight() {
	const db = testDb();
	const [owner, ben] = db
		.insert(users)
		.values([
			{ authKind: 'local', username: 'owner', displayName: 'Owner', role: 'owner' },
			{ authKind: 'local', username: 'ben', displayName: 'Ben' }
		])
		.returning()
		.all();
	db.insert(movies)
		.values([
			{ tmdbId: 1, title: 'Alien', seerrStatus: 'none' },
			{ tmdbId: 2, title: 'Brazil' }
		])
		.run();
	const created = createNight(
		db,
		owner.id,
		{
			title: 'Friday',
			scheduledFor: null,
			nominateUntil: null,
			voteUntil: null,
			maxNominations: 2,
			maxVotes: 2,
			selfVoteAllowed: false,
			secretBallot: true
		},
		now
	);
	if (!created.ok) throw new Error(created.error);
	const id = created.night.id;
	nominate(db, id, ben.id, 1);
	nominate(db, id, owner.id, 2);
	startVoting(db, id, now);
	const alien = db.select().from(nominations).where(eq(nominations.tmdbId, 1)).get()!;
	castVote(db, id, owner.id, alien.id);
	closeVoting(db, id, now, 'seed');
	return { db, owner, ben, id };
}

describe('watched nights and ratings', () => {
	it('can only rate after the night is marked watched', () => {
		const { db, ben, id } = closedNight();
		expect(rate(db, id, ben.id, 4, null)).toMatchObject({ ok: false });
		expect(markWatched(db, id, now)).toEqual({ ok: true });
		expect(getNight(db, id)).toMatchObject({ status: 'watched', watchedAt: now });
		expect(markWatched(db, id, now)).toMatchObject({ ok: false });
	});

	it('stores one rating per person (updating on re-rate) and averages them', () => {
		const { db, owner, ben, id } = closedNight();
		markWatched(db, id, now);

		expect(rate(db, id, ben.id, 0, null)).toMatchObject({ ok: false });
		rate(db, id, ben.id, 2, 'meh');
		rate(db, id, ben.id, 5, '  Loved it!  ');
		rate(db, id, owner.id, 3, '');

		const r = nightRatings(db, id, ben.id);
		expect(r.rows).toHaveLength(2);
		expect(r.average).toBe(4);
		expect(r.mine).toMatchObject({ score: 5, comment: 'Loved it!' });
		expect(r.rows.find((x) => x.userId === owner.id)?.comment).toBeNull();
	});

	it('lists past nights with winner and rating, newest first', () => {
		const { db, ben, id } = closedNight();
		markWatched(db, id, now);
		rate(db, id, ben.id, 4, null);

		const [past] = pastNights(db);
		expect(past).toMatchObject({
			id,
			status: 'watched',
			winner: expect.objectContaining({ title: 'Alien' }),
			averageRating: 4,
			ratingCount: 1,
			nominationCount: 2
		});
	});

	it('prompts for a rating within a week of watching, until you rate', () => {
		const { db, ben, id } = closedNight();
		expect(ratingPrompt(db, ben.id, now)).toBeNull(); // not watched yet
		markWatched(db, id, now);

		expect(ratingPrompt(db, ben.id, new Date(now.getTime() + DAY))?.id).toBe(id);
		expect(ratingPrompt(db, ben.id, new Date(now.getTime() + 8 * DAY))).toBeNull();
		rate(db, id, ben.id, 3, null);
		expect(ratingPrompt(db, ben.id, new Date(now.getTime() + DAY))).toBeNull();
	});

	it('takes watched nights off the home page and out of Most Wanted', () => {
		const { db, ben, id } = closedNight();
		addToWatchlist(db, ben.id, 1);
		expect(currentNight(db)?.id).toBe(id);
		markWatched(db, id, now);
		expect(currentNight(db)).toBeUndefined();
		expect(mostWanted(db)).toEqual([]);
	});
});

describe('requesting movies', () => {
	const seerrWith = (status: number, body: unknown = {}) => {
		const fetchFn = vi.fn(async () => Response.json(body, { status }));
		return { fetchFn, seerr: new SeerrClient('http://seerr:5055', 'k', fetchFn as typeof fetch) };
	};

	it('posts the request, marks the movie pending and logs it', async () => {
		const { db, owner } = closedNight();
		const { seerr, fetchFn } = seerrWith(201);

		expect(await requestMovie(db, seerr, 1, owner.id)).toEqual({ ok: true, already: false });
		expect(fetchFn).toHaveBeenCalledWith(
			'http://seerr:5055/api/v1/request',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ mediaType: 'movie', mediaId: 1 })
			})
		);
		expect(db.select().from(movies).where(eq(movies.tmdbId, 1)).get()?.seerrStatus).toBe('pending');
		expect(db.select().from(auditLog).all()).toEqual([
			expect.objectContaining({ userId: owner.id, action: 'request_movie' })
		]);
	});

	it('treats a duplicate request as done and reports other errors', async () => {
		const { db, owner } = closedNight();
		expect(await requestMovie(db, seerrWith(409).seerr, 1, owner.id)).toEqual({
			ok: true,
			already: true
		});
		expect(
			await requestMovie(db, seerrWith(403, { message: 'Quota exceeded' }).seerr, 1, owner.id)
		).toEqual({ ok: false, error: "Seerr couldn't request it: Quota exceeded" });
		expect(await requestMovie(db, null, 1, owner.id)).toMatchObject({ ok: false });
	});
});
