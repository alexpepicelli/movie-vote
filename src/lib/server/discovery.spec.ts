import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteClient, type Db } from './db/client';
import { testDb } from './test-db';
import { movies, users } from './db/schema';
import { addToWatchlist } from './watchlist';

const state = vi.hoisted(() => ({ db: null as Db | null, getSeerr: vi.fn() }));
vi.mock('#lib/server/db/index.js', () => ({
	get db() {
		return state.db;
	}
}));
vi.mock('#lib/server/integrations.js', () => ({ getSeerr: state.getSeerr }));
import { load } from '../../routes/discover/+page.server';

const browse = (query: string) =>
	load({
		url: new URL(`http://localhost/discover${query}`),
		locals: { user: { id: 'viewer' } }
	} as Parameters<typeof load>[0]);

describe('merged movie library', () => {
	beforeEach(() => {
		state.db = testDb();
		state.getSeerr.mockReset().mockReturnValue(undefined);
		state.db
			.insert(users)
			.values({ id: 'viewer', authKind: 'local', username: 'viewer', displayName: 'Viewer' })
			.run();
		state.db
			.insert(movies)
			.values([
				{ tmdbId: 1, title: 'Arrival', year: 2016 },
				{ tmdbId: 2, title: 'Heat', year: 1995 }
			])
			.run();
		addToWatchlist(state.db, 'viewer', 1);
		addToWatchlist(state.db, 'viewer', 2);
	});
	afterEach(() => {
		if (state.db) sqliteClient(state.db).close();
	});
	it('keeps saved collections searchable without Seerr', async () => {
		expect(await browse('?tab=mine&q=ARR')).toMatchObject({
			configured: false,
			mineCount: 2,
			mine: [{ movie: { title: 'Arrival' } }]
		});
	});
	it('sorts saved titles without making discovery requests', async () => {
		const search = vi.fn();
		state.getSeerr.mockReturnValue({ search });
		expect(await browse('?tab=mine&sort=title')).toMatchObject({
			mine: [{ movie: { title: 'Arrival' } }, { movie: { title: 'Heat' } }]
		});
		expect(search).not.toHaveBeenCalled();
	});
	it('retains local collections and a working feed when the other feed fails', async () => {
		state.getSeerr.mockReturnValue({
			trending: vi.fn().mockRejectedValue(new Error('offline')),
			popular: vi.fn().mockResolvedValue({ results: [] })
		});
		expect(await browse('')).toMatchObject({
			mineCount: 2,
			rows: [{ title: 'Popular right now', movies: [] }],
			error: expect.any(String)
		});
	});
	it('bounds search pages and forwards the trimmed query', async () => {
		const search = vi.fn().mockResolvedValue({ page: 50, totalPages: 100, results: [] });
		state.getSeerr.mockReturnValue({ search });
		await browse('?q=%20Heat%20&page=999');
		expect(search).toHaveBeenCalledWith('Heat', 50);
	});
});
