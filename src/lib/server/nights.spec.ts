import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './test-db';
import { movies, nominations, users } from './db/schema';
import {
	advanceDueNights,
	cancelNight,
	castVote,
	closeVoting,
	createNight,
	currentNight,
	getNight,
	nightView,
	nominate,
	nominationPicker,
	openNight,
	removeVote,
	startVoting,
	validateNightInput,
	withdraw,
	type NightInput
} from './nights';
import { addToWatchlist } from './watchlist';

const HOUR = 3600_000;
const now = new Date('2026-10-20T09:00:00Z');

const input = (over: Partial<NightInput> = {}): NightInput => ({
	title: 'Friday',
	scheduledFor: null,
	nominateUntil: null,
	voteUntil: null,
	maxNominations: 2,
	maxVotes: 2,
	selfVoteAllowed: false,
	resultsHidden: true,
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
		expect(view.entries.map((e) => [e.movie.tmdbId, e.votes, e.rank])).toEqual([
			[2, 2, 1],
			[3, 1, 2],
			[1, 0, 3]
		]);
		expect(castVote(db, night.id, cat.id, nominationId(db, 1))).toMatchObject({ ok: false });
		expect(currentNight(db)?.id).toBe(night.id);
		expect(openNight(db)).toBeUndefined();
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

	it('cancels a night and frees the slot for a new one', () => {
		const { db, owner, night } = setup();
		expect(cancelNight(db, night.id)).toEqual({ ok: true });
		expect(createNight(db, owner.id, input(), now)).toMatchObject({ ok: true });
	});
});
