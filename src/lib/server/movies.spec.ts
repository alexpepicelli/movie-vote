import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testDb } from './test-db';
import { SeerrClient } from './seerr';
import { RadarrClient } from './radarr';
import { getMovie, refreshStatuses, trackedStaleMovieIds, withCachedStatus } from './movies';
import { getImage, isValidImage } from './images';
import { displayStatus } from '../status';
import { createLocalUser } from './auth/users';
import { watchlist } from './db/schema';

const SEERR = 'http://seerr:5055';
const RADARR = 'http://radarr:7878';

/** Routes fetch calls by URL substring → JSON body (or a Response). */
function fakeFetch(routes: Record<string, unknown>) {
	return vi.fn(async (input: string | URL | Request) => {
		const url = String(input);
		const key = Object.keys(routes).find((k) => url.includes(k));
		if (!key) return new Response('not found', { status: 404 });
		const value = routes[key];
		return value instanceof Response ? value : Response.json(value);
	});
}

const matrixDetails = {
	id: 603,
	title: 'The Matrix',
	releaseDate: '1999-03-30',
	overview: 'Neo learns the truth.',
	posterPath: '/poster.jpg',
	backdropPath: '/backdrop.jpg',
	voteAverage: 8.217,
	runtime: 136,
	genres: [{ name: 'Action' }, { name: 'Science Fiction' }],
	relatedVideos: [
		{ site: 'YouTube', key: 'teaser1', type: 'Teaser' },
		{ site: 'YouTube', key: 'trailer1', type: 'Trailer' }
	],
	mediaInfo: { status: 5 }
};

describe('SeerrClient', () => {
	it('maps search results, keeping movies only', async () => {
		const fetchFn = fakeFetch({
			'/api/v1/search': {
				page: 1,
				totalPages: 1,
				results: [
					{ ...matrixDetails, mediaType: 'movie' },
					{ id: 1, mediaType: 'tv', name: 'A show' },
					{ id: 2, mediaType: 'person', name: 'Keanu' }
				]
			}
		});
		const page = await new SeerrClient(SEERR, 'k', fetchFn as typeof fetch).search(
			'the matrix & co'
		);

		expect(page.results).toEqual([
			expect.objectContaining({ tmdbId: 603, year: 1999, rating: 8.2, availability: 'available' })
		]);
		expect(String(fetchFn.mock.calls[0][0])).toContain('query=the%20matrix%20%26%20co');
	});

	it('maps details and prefers the trailer over teasers', async () => {
		const seerr = new SeerrClient(
			SEERR,
			'k',
			fakeFetch({ '/movie/603': matrixDetails }) as typeof fetch
		);
		expect(await seerr.movie(603)).toMatchObject({
			runtime: 136,
			genres: ['Action', 'Science Fiction'],
			trailerKey: 'trailer1'
		});
	});
});

describe('RadarrClient', () => {
	it('reports available, downloading, monitored and missing', async () => {
		const fetchFn = fakeFetch({
			'/api/v3/queue': { records: [{ movieId: 2, size: 1000, sizeleft: 250 }] },
			'tmdbId=10': [{ id: 1, tmdbId: 10, hasFile: true, monitored: true }],
			'tmdbId=20': [{ id: 2, tmdbId: 20, hasFile: false, monitored: true }],
			'tmdbId=30': [{ id: 3, tmdbId: 30, hasFile: false, monitored: true }],
			'tmdbId=40': []
		});
		const states = await new RadarrClient(RADARR, 'k', fetchFn as typeof fetch).states([
			10, 20, 30, 40
		]);

		expect(Object.fromEntries(states)).toEqual({
			10: { status: 'available' },
			20: { status: 'downloading', progress: 75 },
			30: { status: 'monitored' },
			40: { status: 'missing' }
		});
	});
});

describe('movie cache', () => {
	it('fetches once, then serves from cache until stale', async () => {
		const db = testDb();
		const fetchFn = fakeFetch({ '/movie/603': matrixDetails });
		const seerr = new SeerrClient(SEERR, 'k', fetchFn as typeof fetch);
		const now = new Date();

		const first = await getMovie(db, seerr, 603, now);
		await getMovie(db, seerr, 603, new Date(now.getTime() + 60_000));
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(first).toMatchObject({ title: 'The Matrix', tmdbRating: 82, seerrStatus: 'available' });

		await getMovie(db, seerr, 603, new Date(now.getTime() + 8 * 24 * 3600_000));
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it('serves a stale copy when Seerr is down, and null for unknown movies', async () => {
		const db = testDb();
		const old = new Date(Date.now() - 30 * 24 * 3600_000);
		await getMovie(
			db,
			new SeerrClient(SEERR, 'k', fakeFetch({ '/movie/603': matrixDetails }) as typeof fetch),
			603,
			old
		);

		const down = new SeerrClient(
			SEERR,
			'k',
			fakeFetch({ '/movie/603': new Response(null, { status: 500 }) }) as typeof fetch
		);
		expect((await getMovie(db, down, 603))?.title).toBe('The Matrix');
		expect(await getMovie(db, down, 999)).toBeNull(); // 404 from fakeFetch
	});

	it('refreshes Radarr status for tracked movies and overlays it on search results', async () => {
		const db = testDb();
		const user = await createLocalUser(db, {
			username: 'a',
			displayName: 'A',
			password: 'password1',
			role: 'owner'
		});
		const seerr = new SeerrClient(
			SEERR,
			'k',
			fakeFetch({ '/movie/603': matrixDetails }) as typeof fetch
		);
		await getMovie(db, seerr, 603);
		db.insert(watchlist).values({ userId: user.id, tmdbId: 603 }).run();

		expect(trackedStaleMovieIds(db)).toEqual([603]);

		const radarr = new RadarrClient(
			RADARR,
			'k',
			fakeFetch({
				'/api/v3/queue': { records: [{ movieId: 1, size: 100, sizeleft: 60 }] },
				'tmdbId=603': [{ id: 1, tmdbId: 603, hasFile: false, monitored: true }]
			}) as typeof fetch
		);
		await refreshStatuses(db, radarr, [603]);

		expect(trackedStaleMovieIds(db)).toEqual([]);
		const [overlaid] = withCachedStatus(db, [{ tmdbId: 603 } as never]);
		expect(overlaid).toMatchObject({ radarrStatus: 'downloading', radarrProgress: 40 });
	});
});

describe('displayStatus', () => {
	it('prefers Radarr, falls back to Seerr', () => {
		expect(displayStatus({ radarrStatus: 'available' }).kind).toBe('available');
		expect(displayStatus({ seerrStatus: 'available' }).kind).toBe('available');
		expect(displayStatus({ radarrStatus: 'missing', seerrStatus: 'available' }).kind).toBe('none');
		expect(displayStatus({ radarrStatus: 'downloading', radarrProgress: 42 }).label).toBe(
			'Downloading 42%'
		);
		expect(displayStatus({ radarrStatus: 'monitored' }).kind).toBe('requested');
		expect(displayStatus({ seerrStatus: 'pending' }).kind).toBe('requested');
		expect(displayStatus({}).kind).toBe('none');
	});
});

describe('image proxy', () => {
	let dir: string | undefined;
	afterEach(async () => {
		if (dir) await rm(dir, { recursive: true, force: true });
	});

	it('only accepts known sizes and plain file names', () => {
		expect(isValidImage('w342', 'abc_123-x.jpg')).toBe(true);
		expect(isValidImage('w9999', 'abc.jpg')).toBe(false);
		expect(isValidImage('w342', '../secret.jpg')).toBe(false);
		expect(isValidImage('w342', 'abc.svg')).toBe(false);
	});

	it('downloads once, then serves from disk', async () => {
		dir = await mkdtemp(join(tmpdir(), 'votarr-img-'));
		const fetchFn = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));

		const a = await getImage(dir, 'w342', 'p.jpg', fetchFn as typeof fetch);
		const b = await getImage(dir, 'w342', 'p.jpg', fetchFn as typeof fetch);

		expect([...a!]).toEqual([1, 2, 3]);
		expect([...b!]).toEqual([1, 2, 3]);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(fetchFn).toHaveBeenCalledWith(
			'https://image.tmdb.org/t/p/w342/p.jpg',
			expect.anything()
		);
	});
});
