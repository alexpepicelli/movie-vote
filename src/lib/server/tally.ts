import { createHash } from 'node:crypto';

export type TallyInput = {
	nominations: { id: string; tmdbId: number }[];
	/** value is +1 (up) or -1 (down); omitted means up, as votes were before downvotes existed. */
	votes: { nominationId: string; value?: number }[];
	/** tmdbId → number of watchlists the movie is on when voting closes. */
	saves: Map<number, number>;
	/** Public seed for the random tie-break; anyone can recompute the draw from it. */
	seed: string;
};

export type RankedEntry = {
	nominationId: string;
	tmdbId: number;
	/** Ups minus downs. */
	score: number;
	ups: number;
	downs: number;
	/** Same as score. Results stored before downvotes only have this field. */
	votes: number;
	saves: number;
	rank: number; // 1-based, strictly ordered (ties are broken)
};

export type TieBreak =
	| { by: 'none' }
	| { by: 'ups'; tiedWith: number[] } // tied on score, won on upvotes
	| { by: 'saves'; tiedWith: number[] } // tied on score and upvotes, won on watchlist saves
	| { by: 'random'; tiedWith: number[]; seed: string }; // tied on all of those

export type TallyResult = {
	ranking: RankedEntry[];
	winnerTmdbId: number | null;
	tieBreak: TieBreak;
};

/** Deterministic, verifiable "random" draw: sha256(seed:tmdbId). */
export const drawKey = (seed: string, tmdbId: number) =>
	createHash('sha256').update(`${seed}:${tmdbId}`).digest('hex');

/** Scores from rows saved before M9 lack ups/downs; treat their votes as all upvotes. */
export function scoreOf(e: Pick<RankedEntry, 'votes'> & Partial<RankedEntry>) {
	const score = e.score ?? e.votes;
	return { score, ups: e.ups ?? e.votes, downs: e.downs ?? 0 };
}

/**
 * Up/down voting: the highest score (ups minus downs) wins.
 * Tie-break: more upvotes, then more watchlist saves, then the seeded random draw.
 */
export function tally({ nominations, votes, saves, seed }: TallyInput): TallyResult {
	const ups = new Map<string, number>();
	const downs = new Map<string, number>();
	for (const v of votes) {
		const bucket = (v.value ?? 1) < 0 ? downs : ups;
		bucket.set(v.nominationId, (bucket.get(v.nominationId) ?? 0) + 1);
	}

	const entries = nominations.map((n) => {
		const u = ups.get(n.id) ?? 0;
		const d = downs.get(n.id) ?? 0;
		return {
			nominationId: n.id,
			tmdbId: n.tmdbId,
			score: u - d,
			ups: u,
			downs: d,
			saves: saves.get(n.tmdbId) ?? 0,
			key: drawKey(seed, n.tmdbId)
		};
	});

	entries.sort(
		(a, b) =>
			b.score - a.score ||
			b.ups - a.ups ||
			b.saves - a.saves ||
			(a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
	);

	const ranking: RankedEntry[] = entries.map((e, i) => ({
		nominationId: e.nominationId,
		tmdbId: e.tmdbId,
		score: e.score,
		ups: e.ups,
		downs: e.downs,
		votes: e.score,
		saves: e.saves,
		rank: i + 1
	}));
	const [winner] = ranking;
	if (!winner) return { ranking, winnerTmdbId: null, tieBreak: { by: 'none' } };

	const tiedOnScore = ranking.filter((e) => e !== winner && e.score === winner.score);
	const tiedOnUps = tiedOnScore.filter((e) => e.ups === winner.ups);
	const tiedOnSaves = tiedOnUps.filter((e) => e.saves === winner.saves);
	const ids = (list: RankedEntry[]) => list.map((e) => e.tmdbId);

	const tieBreak: TieBreak =
		tiedOnScore.length === 0
			? { by: 'none' }
			: tiedOnUps.length === 0
				? { by: 'ups', tiedWith: ids(tiedOnScore) }
				: tiedOnSaves.length === 0
					? { by: 'saves', tiedWith: ids(tiedOnUps) }
					: { by: 'random', tiedWith: ids(tiedOnSaves), seed };

	return { ranking, winnerTmdbId: winner.tmdbId, tieBreak };
}
