import { describe, expect, it } from 'vitest';
import { drawKey, tally } from './tally';

const noms = (...ids: number[]) => ids.map((tmdbId) => ({ id: `n${tmdbId}`, tmdbId }));
const votesFor = (counts: Record<number, number>) =>
	Object.entries(counts).flatMap(([tmdbId, n]) =>
		Array.from({ length: n }, () => ({ nominationId: `n${tmdbId}` }))
	);

describe('tally', () => {
	it('picks the movie with the most votes', () => {
		const r = tally({
			nominations: noms(1, 2, 3),
			votes: votesFor({ 1: 1, 2: 3, 3: 2 }),
			saves: new Map(),
			seed: 's'
		});
		expect(r.winnerTmdbId).toBe(2);
		expect(r.ranking.map((e) => [e.tmdbId, e.votes, e.rank])).toEqual([
			[2, 3, 1],
			[3, 2, 2],
			[1, 1, 3]
		]);
		expect(r.tieBreak).toEqual({ by: 'none' });
	});

	it('breaks a vote tie on watchlist saves', () => {
		const r = tally({
			nominations: noms(1, 2, 3),
			votes: votesFor({ 1: 2, 2: 2, 3: 1 }),
			saves: new Map([
				[1, 1],
				[2, 4]
			]),
			seed: 's'
		});
		expect(r.winnerTmdbId).toBe(2);
		expect(r.tieBreak).toEqual({ by: 'saves', tiedWith: [1] });
	});

	it('falls back to a seeded draw that anyone can recompute', () => {
		const input = {
			nominations: noms(1, 2, 3),
			votes: votesFor({ 1: 2, 2: 2, 3: 2 }),
			saves: new Map([
				[1, 1],
				[2, 1],
				[3, 1]
			]),
			seed: 'abc123'
		};
		const r = tally(input);
		const expected = [1, 2, 3].sort((a, b) =>
			drawKey('abc123', a) < drawKey('abc123', b) ? -1 : 1
		);

		expect(r.winnerTmdbId).toBe(expected[0]);
		expect(r.tieBreak).toEqual({ by: 'random', tiedWith: expected.slice(1), seed: 'abc123' });
		expect(tally(input)).toEqual(r); // deterministic
	});

	it('only reports the films actually tied with the winner', () => {
		const r = tally({
			nominations: noms(1, 2, 3),
			votes: votesFor({ 1: 3, 2: 3, 3: 3 }),
			saves: new Map([
				[1, 5],
				[2, 5],
				[3, 1]
			]),
			seed: 'x'
		});
		expect(r.tieBreak.by).toBe('random');
		expect(r.tieBreak.by === 'random' && r.tieBreak.tiedWith).toHaveLength(1);
		expect(r.ranking.at(-1)?.tmdbId).toBe(3);
	});

	it('ranks by score, ups minus downs', () => {
		const r = tally({
			nominations: noms(1, 2),
			votes: [
				...votesFor({ 1: 3, 2: 2 }),
				{ nominationId: 'n1', value: -1 },
				{ nominationId: 'n1', value: -1 }
			],
			saves: new Map(),
			seed: 's'
		});
		expect(r.winnerTmdbId).toBe(2);
		expect(r.ranking.map((e) => [e.tmdbId, e.score, e.ups, e.downs])).toEqual([
			[2, 2, 2, 0],
			[1, 1, 3, 2]
		]);
	});

	it('breaks a score tie on upvotes before watchlist saves', () => {
		const r = tally({
			nominations: noms(1, 2),
			votes: [...votesFor({ 1: 1, 2: 2 }), { nominationId: 'n2', value: -1 }],
			saves: new Map([[1, 9]]),
			seed: 's'
		});
		expect(r.winnerTmdbId).toBe(2);
		expect(r.tieBreak).toEqual({ by: 'ups', tiedWith: [1] });
	});

	it('handles nights with no nominations or no votes', () => {
		expect(tally({ nominations: [], votes: [], saves: new Map(), seed: 's' })).toEqual({
			ranking: [],
			winnerTmdbId: null,
			tieBreak: { by: 'none' }
		});
		const single = tally({ nominations: noms(7), votes: [], saves: new Map(), seed: 's' });
		expect(single.winnerTmdbId).toBe(7);
		expect(single.tieBreak).toEqual({ by: 'none' });
	});
});
