import { createHash } from 'node:crypto';

export type TallyInput = {
	nominations: { id: string; tmdbId: number }[];
	votes: { nominationId: string }[];
	/** tmdbId → number of watchlists the movie is on when voting closes. */
	saves: Map<number, number>;
	/** Public seed for the random tie-break; anyone can recompute the draw from it. */
	seed: string;
};

export type RankedEntry = {
	nominationId: string;
	tmdbId: number;
	votes: number;
	saves: number;
	rank: number; // 1-based, strictly ordered (ties are broken)
};

export type TieBreak =
	| { by: 'none' }
	| { by: 'saves'; tiedWith: number[] } // tied on votes, won on watchlist saves
	| { by: 'random'; tiedWith: number[]; seed: string }; // tied on votes and saves

export type TallyResult = {
	ranking: RankedEntry[];
	winnerTmdbId: number | null;
	tieBreak: TieBreak;
};

/** Deterministic, verifiable "random" draw: sha256(seed:tmdbId). */
export const drawKey = (seed: string, tmdbId: number) =>
	createHash('sha256').update(`${seed}:${tmdbId}`).digest('hex');

/**
 * Approval voting: most upvotes wins.
 * Tie-break: more watchlist saves, then the seeded random draw.
 */
export function tally({ nominations, votes, saves, seed }: TallyInput): TallyResult {
	const counts = new Map<string, number>();
	for (const v of votes) counts.set(v.nominationId, (counts.get(v.nominationId) ?? 0) + 1);

	const entries = nominations.map((n) => ({
		nominationId: n.id,
		tmdbId: n.tmdbId,
		votes: counts.get(n.id) ?? 0,
		saves: saves.get(n.tmdbId) ?? 0,
		key: drawKey(seed, n.tmdbId)
	}));

	entries.sort(
		(a, b) => b.votes - a.votes || b.saves - a.saves || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
	);

	const ranking = entries.map((e, i) => ({
		nominationId: e.nominationId,
		tmdbId: e.tmdbId,
		votes: e.votes,
		saves: e.saves,
		rank: i + 1
	}));
	const [winner] = ranking;
	if (!winner) return { ranking, winnerTmdbId: null, tieBreak: { by: 'none' } };

	const tiedOnVotes = ranking.filter((e) => e.votes === winner.votes && e !== winner);
	const tiedOnSaves = tiedOnVotes.filter((e) => e.saves === winner.saves);

	const tieBreak: TieBreak =
		tiedOnVotes.length === 0
			? { by: 'none' }
			: tiedOnSaves.length === 0
				? { by: 'saves', tiedWith: tiedOnVotes.map((e) => e.tmdbId) }
				: { by: 'random', tiedWith: tiedOnSaves.map((e) => e.tmdbId), seed };

	return { ranking, winnerTmdbId: winner.tmdbId, tieBreak };
}
