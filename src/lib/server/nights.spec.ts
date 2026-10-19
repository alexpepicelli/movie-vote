import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './test-db';
import { movies, nights, nominations, users } from './db/schema';
import {
	advanceDueNights,
	cancelNight,
	castVote,
	closeVoting,
	createNight,
	currentNight,
	getNight,
	joinNight,
	leaveNight,
	nightView,
	nominate,
	nominationPicker,
	openNight,
	removeVote,
	startVoting,
	validateNightInput,
	withdraw,
	setTheme,
	type NightInput
} from './nights';
import { addToWatchlist } from './watchlist';

const HOUR = 3600_000;
const now = new Date('2026-10-20T09:00:00Z');

const input = (over: Partial<NightInput> = {}): NightInput => ({
	title: 'Friday',
	theme: 'synthwave',
	scheduledFor: null,
	nominateUntil: null,
	voteUntil: null,
	maxNominations: 2,
	maxVotes: 2,
	selfVoteAllowed: false,
	secretBallot: true,
	...over
});

function setup() {
	const db = testDb();
	const [owner, ben, cat] = db
		.insert(users)
		.values(
			(['owner', 'ben', 'cat'] as const).map((u) => ({
				authKind: 'local' as const,
				username: u,
				displayName: u,
				role: u === 'owner' ? ('owner' as const) : ('member' as const)
			}))
		)
		.returning()
		.all();
	db.insert(movies)
		.values([1, 2, 3, 4].map((tmdbId) => ({ tmdbId, title: `Movie ${tmdbId}` })))
		.run();
	const created = createNight(db, owner.id, input(), now);
	if (!created.ok) throw new Error(created.error);
	return { db, owner, ben, cat, night: created.night };
}

const nominationId = (db: ReturnType<typeof testDb>, tmdbId: number) =>
	db.select().from(nominations).where(eq(nominations.tmdbId, tmdbId)).get()!.id;

describe('creating nights', () => {
	it('validates settings', () => {
		expect(validateNightInput(input({ title: '' }), now)).toMatch(/title/);
		expect(validateNightInput(input({ maxVotes: 0 }), now)).toMatch(/Votes/);
		expect(validateNightInput(input({ theme: 'nope' }), now)).toMatch(/theme/i);
		expect(validateNightInput(input({ theme: 'halloween' }), now)).toBeNull();
		expect(validateNightInput(input({ nominateUntil: new Date(now.getTime() - 1) }), now)).toMatch(
			/future/
		);
		expect(
			validateNightInput(
				input({
					nominateUntil: new Date(now.getTime() + 2 * HOUR),
					voteUntil: new Date(now.getTime() + HOUR)
				}),
				now
			)
		).toMatch(/after nominations/);
		expect(validateNightInput(input(), now)).toBeNull();
	});

	it('opens straight into nominations and allows only one open night', () => {
		const { db, owner, night } = setup();
		expect(night.status).toBe('nominating');
		expect(openNight(db)?.id).toBe(night.id);
		expect(createNight(db, owner.id, input(), now)).toMatchObject({ ok: false });
	});
});

describe('nominating', () => {
	it('enforces the per-person limit and uniqueness', () => {
		const { db, ben, cat, night } = setup();
		expect(nominate(db, night.id, ben.id, 1)).toEqual({ ok: true });
		expect(nominate(db, night.id, cat.id, 1)).toMatchObject({ ok: false, error: /already/ });
		expect(nominate(db, night.id, ben.id, 2)).toEqual({ ok: true });
		expect(nominate(db, night.id, ben.id, 3)).toMatchObject({ ok: false, error: /all 2/ });
	});

	it('lets members withdraw their own, and the owner withdraw anyone’s', () => {
		const { db, owner, ben, cat, night } = setup();
		nominate(db, night.id, ben.id, 1);
		const id = nominationId(db, 1);

		expect(withdraw(db, night.id, id, cat)).toMatchObject({ ok: false });
		expect(withdraw(db, night.id, id, owner)).toEqual({ ok: true });
		expect(nominate(db, night.id, ben.id, 1)).toEqual({ ok: true });
	});

	it('picker lists my watchlist oldest first, then others’ wants, minus nominated', () => {
		const { db, ben, cat, night } = setup();
		addToWatchlist(db, ben.id, 2, new Date(now.getTime() + 2));
		addToWatchlist(db, ben.id, 1, new Date(now.getTime() + 1));
		addToWatchlist(db, ben.id, 3, new Date(now.getTime() + 3));
		addToWatchlist(db, cat.id, 4);
		nominate(db, night.id, cat.id, 3);

		const picker = nominationPicker(db, night.id, ben.id);
		expect(picker.mine.map((m) => m.tmdbId)).toEqual([1, 2]);
		expect(picker.group.map((m) => m.movie.tmdbId)).toEqual([4]);
	});

	it('rejects nominations once voting starts', () => {
		const { db, ben, night } = setup();
		startVoting(db, night.id, now);
		expect(nominate(db, night.id, ben.id, 1)).toMatchObject({ ok: false, error: /closed/ });
	});
});

describe('voting', () => {
	function voting() {
		const s = setup();
		nominate(s.db, s.night.id, s.ben.id, 1);
		nominate(s.db, s.night.id, s.cat.id, 2);
		nominate(s.db, s.night.id, s.owner.id, 3);
		startVoting(s.db, s.night.id, now);
		return s;
	}

	it('enforces phase, own-nomination and vote limit rules', () => {
		const { db, ben, night } = voting();
		expect(castVote(db, night.id, ben.id, nominationId(db, 1))).toMatchObject({
			ok: false,
			error: /own nomination/
		});
		expect(castVote(db, night.id, ben.id, nominationId(db, 2))).toEqual({ ok: true });
		expect(castVote(db, night.id, ben.id, nominationId(db, 2))).toEqual({ ok: true }); // idempotent
		expect(castVote(db, night.id, ben.id, nominationId(db, 3))).toEqual({ ok: true });
		expect(castVote(db, night.id, ben.id, nominationId(db, 3))).toEqual({ ok: true });

		db.insert(movies).values({ tmdbId: 5, title: 'Late' }).run();
		expect(nominate(db, night.id, ben.id, 5)).toMatchObject({ ok: false });

		expect(removeVote(db, night.id, ben.id, nominationId(db, 3))).toEqual({ ok: true });
		expect(nightView(db, getNight(db, night.id)!, ben.id).myVoteCount).toBe(1);
	});

	it('flips a vote between up and down without using another vote', () => {
		const { db, ben, night } = voting();
		const two = nominationId(db, 2);
		expect(castVote(db, night.id, ben.id, two, -1)).toEqual({ ok: true });
		expect(castVote(db, night.id, ben.id, two, 1)).toEqual({ ok: true });

		const view = nightView(db, getNight(db, night.id)!, ben.id);
		expect(view.myVoteCount).toBe(1);
		expect(view.entries.find((e) => e.id === two)?.myVote).toBe(1);
	});

	it('counts downvotes against the same budget as upvotes', () => {
		const { db, ben, night } = voting();
		expect(castVote(db, night.id, ben.id, nominationId(db, 2), -1)).toEqual({ ok: true });
		expect(castVote(db, night.id, ben.id, nominationId(db, 3), 1)).toEqual({ ok: true });
		expect(castVote(db, night.id, ben.id, nominationId(db, 1), -1)).toMatchObject({
			ok: false,
			error: /own nomination/
		});
		// One down and one up use both of this night's two votes.
		expect(nightView(db, getNight(db, night.id)!, ben.id).myVoteCount).toBe(2);
		removeVote(db, night.id, ben.id, nominationId(db, 2));
		expect(nightView(db, getNight(db, night.id)!, ben.id).myVoteCount).toBe(1);
	});

	it('ranks by score, so downvotes can sink a film', () => {
		const { db, owner, ben, cat, night } = voting(); // ben picked 1, cat 2, owner 3
		castVote(db, night.id, cat.id, nominationId(db, 3));
		castVote(db, night.id, ben.id, nominationId(db, 3));
		castVote(db, night.id, cat.id, nominationId(db, 1));
		castVote(db, night.id, owner.id, nominationId(db, 2));
		castVote(db, night.id, ben.id, nominationId(db, 2), -1);

		closeVoting(db, night.id, now, 'seed');
		const view = nightView(db, getNight(db, night.id)!, ben.id);
		expect(view.entries.map((e) => [e.movie.tmdbId, e.votes])).toEqual([
			[3, { score: 2, ups: 2, downs: 0 }],
			[1, { score: 1, ups: 1, downs: 0 }],
			[2, { score: 0, ups: 1, downs: 1 }]
		]);
	});

	it('hides counts during voting when results are hidden', () => {
		const { db, ben, cat, night } = voting();
		castVote(db, night.id, ben.id, nominationId(db, 2));
		const view = nightView(db, getNight(db, night.id)!, cat.id);
		expect(view.entries.every((e) => e.votes === null)).toBe(true);
		expect(view.voterCount).toBe(1);
		expect(view.memberCount).toBe(3);
	});

	it('closes with a stored winner and ranking', () => {
		const { db, owner, ben, cat, night } = voting();
		castVote(db, night.id, ben.id, nominationId(db, 2));
		castVote(db, night.id, owner.id, nominationId(db, 2));
		castVote(db, night.id, cat.id, nominationId(db, 3));

		expect(closeVoting(db, night.id, now, 'seed')).toEqual({ ok: true });
		const closed = getNight(db, night.id)!;
		expect(closed).toMatchObject({ status: 'closed', winnerTmdbId: 2, tiebreakSeed: 'seed' });

		const view = nightView(db, closed, ben.id);
		expect(view.entries.map((e) => [e.movie.tmdbId, e.votes?.score, e.rank])).toEqual([
			[2, 2, 1],
			[3, 1, 2],
			[1, 0, 3]
		]);
		expect(castVote(db, night.id, cat.id, nominationId(db, 1))).toMatchObject({ ok: false });
		expect(currentNight(db)?.id).toBe(night.id);
		expect(openNight(db)).toBeUndefined();
	});
});

describe('people and visible votes', () => {
	function voting(secretBallot: boolean) {
		const s = setup();
		s.db.update(nights).set({ secretBallot }).where(eq(nights.id, s.night.id)).run();
		nominate(s.db, s.night.id, s.ben.id, 1);
		nominate(s.db, s.night.id, s.cat.id, 2);
		startVoting(s.db, s.night.id, now);
		return s;
	}
	const nominationId = (db: ReturnType<typeof testDb>, tmdbId: number) =>
		db.select().from(nominations).where(eq(nominations.tmdbId, tmdbId)).get()!.id;

	it('counts people as going once they say so, nominate or vote', () => {
		const { db, owner, ben, cat, night } = voting(false);
		const going = () =>
			Object.fromEntries(
				nightView(db, getNight(db, night.id)!, owner.id).people.map((p) => [p.displayName, p.going])
			);
		expect(going()).toEqual({ owner: false, ben: true, cat: true });

		expect(joinNight(db, night.id, owner.id)).toEqual({ ok: true });
		expect(going().owner).toBe(true);
		expect(leaveNight(db, night.id, owner.id)).toEqual({ ok: true });
		expect(going().owner).toBe(false);

		castVote(db, night.id, owner.id, nominationId(db, 1));
		expect(going().owner).toBe(true);
		expect(leaveNight(db, night.id, owner.id)).toMatchObject({ ok: false, error: /already in/ });
		expect(leaveNight(db, night.id, cat.id)).toMatchObject({ ok: false }); // nominated
		expect(ben.id).toBeTruthy();
	});

	it('shows who voted which way on an open ballot', () => {
		const { db, owner, ben, cat, night } = voting(false);
		castVote(db, night.id, owner.id, nominationId(db, 1));
		castVote(db, night.id, cat.id, nominationId(db, 1), -1);

		const view = nightView(db, getNight(db, night.id)!, ben.id);
		const film1 = view.entries.find((e) => e.movie.tmdbId === 1)!;
		expect(film1.voters?.map((v) => [v.displayName, v.value])).toEqual([
			['owner', 1],
			['cat', -1]
		]);
		expect(film1.votes).toEqual({ score: 0, ups: 1, downs: 1 });
		expect(view.people.find((p) => p.displayName === 'owner')?.voted).toBe(true);
	});

	it('hides voters and scores on a secret ballot, except your own status', () => {
		const { db, owner, ben, night } = voting(true);
		castVote(db, night.id, owner.id, nominationId(db, 2));
		castVote(db, night.id, ben.id, nominationId(db, 2));

		const view = nightView(db, getNight(db, night.id)!, ben.id);
		expect(view.entries.every((e) => e.voters === null && e.votes === null)).toBe(true);
		expect(view.people.find((p) => p.displayName === 'owner')?.voted).toBeNull();
		expect(view.people.find((p) => p.me)?.voted).toBe(true);
		expect(view.voterCount).toBe(2);

		closeVoting(db, night.id, now, 'seed');
		const closed = nightView(db, getNight(db, night.id)!, ben.id);
		expect(closed.entries.every((e) => e.voters === null)).toBe(true);
		expect(closed.entries[0].votes?.score).toBe(2);
	});
});

describe('deadlines', () => {
	it('advances nominating → voting → closed as deadlines pass', () => {
		const db = testDb();
		const [owner] = db
			.insert(users)
			.values({ authKind: 'local', username: 'o', displayName: 'O', role: 'owner' })
			.returning()
			.all();
		const created = createNight(
			db,
			owner.id,
			input({
				nominateUntil: new Date(now.getTime() + HOUR),
				voteUntil: new Date(now.getTime() + 2 * HOUR)
			}),
			now
		);
		if (!created.ok) throw new Error(created.error);
		const id = created.night.id;

		expect(advanceDueNights(db, new Date(now.getTime() + 30 * 60_000))).toEqual([]);
		expect(advanceDueNights(db, new Date(now.getTime() + HOUR))).toEqual([
			{ nightId: id, to: 'voting' }
		]);
		expect(advanceDueNights(db, new Date(now.getTime() + 3 * HOUR))).toEqual([
			{ nightId: id, to: 'closed' }
		]);
		expect(getNight(db, id)?.winnerTmdbId).toBeNull(); // nobody nominated
	});

	it('lets the theme change after the night is created, to a known theme only', () => {
		const { db, night } = setup();
		expect(night.theme).toBe('synthwave');
		expect(setTheme(db, night.id, 'halloween')).toEqual({ ok: true });
		expect(db.select().from(nights).where(eq(nights.id, night.id)).get()?.theme).toBe('halloween');
		expect(setTheme(db, night.id, 'nope')).toMatchObject({ ok: false });
	});

	it('cancels a night and frees the slot for a new one', () => {
		const { db, owner, night } = setup();
		expect(cancelNight(db, night.id)).toEqual({ ok: true });
		expect(createNight(db, owner.id, input(), now)).toMatchObject({ ok: true });
	});
});
