import { randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, inArray, lte } from 'drizzle-orm';
import type { Db } from './db/client';
import { movies, nights, nominations, users, votes, watchlist } from './db/schema';
import { tally } from './tally';
import { mostWanted, watchedMovieIds } from './watchlist';

export type Night = typeof nights.$inferSelect;
export type Result = { ok: true } | { ok: false; error: string };

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

const OPEN = ['nominating', 'voting'] as const;

export type NightInput = {
	title: string;
	scheduledFor: Date | null;
	nominateUntil: Date | null;
	voteUntil: Date | null;
	maxNominations: number;
	maxVotes: number;
	selfVoteAllowed: boolean;
	resultsHidden: boolean;
};

/** Returns an error message, or null if the settings are valid. */
export function validateNightInput(input: NightInput, now = new Date()): string | null {
	if (!input.title || input.title.length > 60)
		return 'Give the night a title (up to 60 characters).';
	if (
		!Number.isInteger(input.maxNominations) ||
		input.maxNominations < 1 ||
		input.maxNominations > 5
	)
		return 'Nominations per person must be between 1 and 5.';
	if (!Number.isInteger(input.maxVotes) || input.maxVotes < 1 || input.maxVotes > 10)
		return 'Votes per person must be between 1 and 10.';
	for (const [label, d] of [
		['Movie night date', input.scheduledFor],
		['Nomination deadline', input.nominateUntil],
		['Voting deadline', input.voteUntil]
	] as const) {
		if (d && Number.isNaN(d.getTime())) return `${label} isn't a valid date.`;
	}
	if (input.nominateUntil && input.nominateUntil <= now)
		return 'The nomination deadline needs to be in the future.';
	if (input.voteUntil && input.voteUntil <= now)
		return 'The voting deadline needs to be in the future.';
	if (input.nominateUntil && input.voteUntil && input.voteUntil <= input.nominateUntil)
		return 'Voting has to close after nominations close.';
	return null;
}

/** The night currently taking nominations or votes, if any (only one at a time). */
export function openNight(db: Db): Night | undefined {
	return db
		.select()
		.from(nights)
		.where(inArray(nights.status, [...OPEN]))
		.orderBy(desc(nights.createdAt))
		.get();
}

/** What the home page features: the open night, else the latest closed one. */
export function currentNight(db: Db): Night | undefined {
	return (
		openNight(db) ??
		db.select().from(nights).where(eq(nights.status, 'closed')).orderBy(desc(nights.closedAt)).get()
	);
}

export function getNight(db: Db, id: string): Night | undefined {
	return db.select().from(nights).where(eq(nights.id, id)).get();
}

export function createNight(
	db: Db,
	createdBy: string,
	input: NightInput,
	now = new Date()
): { ok: true; night: Night } | { ok: false; error: string } {
	const error = validateNightInput(input, now);
	if (error) return { ok: false, error };

	return db.transaction((tx) => {
		if (openNight(tx))
			return { ok: false as const, error: 'Finish or cancel the current movie night first.' };
		const night = tx
			.insert(nights)
			.values({ ...input, status: 'nominating', createdBy, createdAt: now })
			.returning()
			.get();
		return { ok: true as const, night };
	});
}

/** The movie must already be cached (see getMovie). */
export function nominate(db: Db, nightId: string, userId: string, tmdbId: number): Result {
	return db.transaction((tx) => {
		const night = getNight(tx, nightId);
		if (night?.status !== 'nominating') return fail('Nominations are closed.');

		const mine = tx
			.select({ n: count() })
			.from(nominations)
			.where(and(eq(nominations.nightId, nightId), eq(nominations.userId, userId)))
			.get()!.n;
		if (mine >= night.maxNominations)
			return fail(
				`You've used all ${night.maxNominations} of your nominations. Withdraw one to pick another.`
			);

		const taken = tx
			.select({ id: nominations.id })
			.from(nominations)
			.where(and(eq(nominations.nightId, nightId), eq(nominations.tmdbId, tmdbId)))
			.get();
		if (taken) return fail('Someone has already nominated that movie.');

		tx.insert(nominations).values({ nightId, tmdbId, userId }).run();
		return OK;
	});
}

/** Members can withdraw their own nominations; the owner can remove anyone's. */
export function withdraw(
	db: Db,
	nightId: string,
	nominationId: string,
	user: { id: string; role: string }
): Result {
	return db.transaction((tx) => {
		const night = getNight(tx, nightId);
		if (night?.status !== 'nominating') return fail('Nominations are closed.');
		const nomination = tx
			.select()
			.from(nominations)
			.where(and(eq(nominations.id, nominationId), eq(nominations.nightId, nightId)))
			.get();
		if (!nomination) return fail('That nomination no longer exists.');
		if (nomination.userId !== user.id && user.role !== 'owner')
			return fail('You can only withdraw your own nominations.');

		tx.delete(nominations).where(eq(nominations.id, nominationId)).run();
		return OK;
	});
}

export function castVote(db: Db, nightId: string, userId: string, nominationId: string): Result {
	return db.transaction((tx) => {
		const night = getNight(tx, nightId);
		if (night?.status !== 'voting') return fail('Voting is closed.');

		const nomination = tx
			.select()
			.from(nominations)
			.where(and(eq(nominations.id, nominationId), eq(nominations.nightId, nightId)))
			.get();
		if (!nomination) return fail('That movie is no longer nominated.');
		if (nomination.userId === userId && !night.selfVoteAllowed)
			return fail("You can't vote for your own nomination.");

		const mine = tx
			.select({ nominationId: votes.nominationId })
			.from(votes)
			.where(and(eq(votes.nightId, nightId), eq(votes.userId, userId)))
			.all();
		if (mine.some((v) => v.nominationId === nominationId)) return OK;
		if (mine.length >= night.maxVotes)
			return fail(`You've used all ${night.maxVotes} votes. Take one back to move it.`);

		tx.insert(votes).values({ nightId, userId, nominationId }).run();
		return OK;
	});
}

export function removeVote(db: Db, nightId: string, userId: string, nominationId: string): Result {
	return db.transaction((tx) => {
		const night = getNight(tx, nightId);
		if (night?.status !== 'voting') return fail('Voting is closed.');
		tx.delete(votes)
			.where(
				and(
					eq(votes.nightId, nightId),
					eq(votes.userId, userId),
					eq(votes.nominationId, nominationId)
				)
			)
			.run();
		return OK;
	});
}

export function startVoting(db: Db, nightId: string, now = new Date()): Result {
	const changed = db
		.update(nights)
		.set({ status: 'voting', votingStartedAt: now })
		.where(and(eq(nights.id, nightId), eq(nights.status, 'nominating')))
		.run().changes;
	return changed ? OK : fail('This night isn’t taking nominations.');
}

/** Closes voting, works out the winner and stores a snapshot of the results. */
export function closeVoting(
	db: Db,
	nightId: string,
	now = new Date(),
	seed = randomBytes(8).toString('hex')
): Result {
	return db.transaction((tx) => {
		const night = getNight(tx, nightId);
		if (night?.status !== 'voting') return fail('This night isn’t in voting.');

		const noms = tx
			.select({ id: nominations.id, tmdbId: nominations.tmdbId })
			.from(nominations)
			.where(eq(nominations.nightId, nightId))
			.all();
		const cast = tx
			.select({ nominationId: votes.nominationId })
			.from(votes)
			.where(eq(votes.nightId, nightId))
			.all();
		const results = tally({
			nominations: noms,
			votes: cast,
			saves: saveCounts(
				tx,
				noms.map((n) => n.tmdbId)
			),
			seed
		});

		tx.update(nights)
			.set({
				status: 'closed',
				closedAt: now,
				tiebreakSeed: seed,
				results,
				winnerTmdbId: results.winnerTmdbId
			})
			.where(eq(nights.id, nightId))
			.run();
		return OK;
	});
}

export function cancelNight(db: Db, nightId: string): Result {
	const changed = db
		.delete(nights)
		.where(and(eq(nights.id, nightId), inArray(nights.status, [...OPEN, 'closed'])))
		.run().changes;
	return changed ? OK : fail('That night can’t be cancelled.');
}

export type Transition = { nightId: string; to: 'voting' | 'closed' };

/** Moves open nights past their deadlines. Safe to call often. */
export function advanceDueNights(db: Db, now = new Date()): Transition[] {
	const done: Transition[] = [];
	const dueNominating = db
		.select({ id: nights.id })
		.from(nights)
		.where(and(eq(nights.status, 'nominating'), lte(nights.nominateUntil, now)))
		.all();
	for (const { id } of dueNominating) {
		if (startVoting(db, id, now).ok) done.push({ nightId: id, to: 'voting' });
	}

	const dueVoting = db
		.select({ id: nights.id })
		.from(nights)
		.where(and(eq(nights.status, 'voting'), lte(nights.voteUntil, now)))
		.all();
	for (const { id } of dueVoting) {
		if (closeVoting(db, id, now).ok) done.push({ nightId: id, to: 'closed' });
	}
	return done;
}

/** tmdbId → number of watchlists it's on. */
export function saveCounts(db: Db, tmdbIds: number[]): Map<number, number> {
	if (tmdbIds.length === 0) return new Map();
	const rows = db
		.select({ tmdbId: watchlist.tmdbId, n: count() })
		.from(watchlist)
		.where(inArray(watchlist.tmdbId, tmdbIds))
		.groupBy(watchlist.tmdbId)
		.all();
	return new Map(rows.map((r) => [r.tmdbId, r.n]));
}

/** Everything the night page needs, scoped to what this user is allowed to see. */
export function nightView(db: Db, night: Night, userId: string) {
	const noms = db
		.select({
			id: nominations.id,
			userId: nominations.userId,
			nominatedBy: users.displayName,
			movie: movies
		})
		.from(nominations)
		.innerJoin(movies, eq(movies.tmdbId, nominations.tmdbId))
		.innerJoin(users, eq(users.id, nominations.userId))
		.where(eq(nominations.nightId, night.id))
		.orderBy(asc(nominations.createdAt))
		.all();

	const allVotes = db
		.select({ userId: votes.userId, nominationId: votes.nominationId })
		.from(votes)
		.where(eq(votes.nightId, night.id))
		.all();

	const showCounts =
		night.status === 'closed' || (night.status === 'voting' && !night.resultsHidden);
	const voteCounts = new Map<string, number>();
	for (const v of allVotes)
		voteCounts.set(v.nominationId, (voteCounts.get(v.nominationId) ?? 0) + 1);

	const saves = saveCounts(
		db,
		noms.map((n) => n.movie.tmdbId)
	);
	const myVotes = new Set(allVotes.filter((v) => v.userId === userId).map((v) => v.nominationId));
	const memberCount = db.select({ n: count() }).from(users).get()!.n;

	const ranking = night.results?.ranking ?? [];
	const rankOf = new Map(ranking.map((r) => [r.nominationId, r]));

	const entries = noms.map((n) => ({
		...n,
		mine: n.userId === userId,
		votedByMe: myVotes.has(n.id),
		votes: showCounts ? (rankOf.get(n.id)?.votes ?? voteCounts.get(n.id) ?? 0) : null,
		saves: rankOf.get(n.id)?.saves ?? saves.get(n.movie.tmdbId) ?? 0,
		rank: rankOf.get(n.id)?.rank ?? null
	}));
	if (night.status === 'closed') entries.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

	return {
		night,
		entries,
		myNominationCount: noms.filter((n) => n.userId === userId).length,
		myVoteCount: myVotes.size,
		voterCount: new Set(allVotes.map((v) => v.userId)).size,
		memberCount
	};
}

/**
 * Picker shown while nominating: your watchlist first (oldest first: wanted it longest),
 * then films other people want. Already-nominated and already-watched films are left out.
 */
export function nominationPicker(db: Db, nightId: string, userId: string) {
	const nominated = new Set(
		db
			.select({ id: nominations.tmdbId })
			.from(nominations)
			.where(eq(nominations.nightId, nightId))
			.all()
			.map((r) => r.id)
	);
	const watched = new Set(watchedMovieIds(db));
	const skip = (id: number) => nominated.has(id) || watched.has(id);

	const mine = db
		.select({ movie: movies })
		.from(watchlist)
		.innerJoin(movies, eq(movies.tmdbId, watchlist.tmdbId))
		.where(eq(watchlist.userId, userId))
		.orderBy(asc(watchlist.addedAt))
		.all()
		.map((r) => r.movie)
		.filter((m) => !skip(m.tmdbId));
	const mineIds = new Set(mine.map((m) => m.tmdbId));

	const group = mostWanted(db, 40)
		.filter((m) => !skip(m.movie.tmdbId) && !mineIds.has(m.movie.tmdbId))
		.slice(0, 12);

	return { mine, group, nominated };
}
