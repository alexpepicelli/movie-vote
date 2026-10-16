import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDatabase, runMigrations } from './client';
import { movies, nights, nominations, users, watchlist } from './schema';

function freshDb() {
	const db = openDatabase(':memory:');
	runMigrations(db);
	return db;
}

function seed(db: ReturnType<typeof freshDb>) {
	const [owner] = db
		.insert(users)
		.values({ authKind: 'local', username: 'alex', displayName: 'Alex', role: 'owner' })
		.returning()
		.all();
	db.insert(movies).values({ tmdbId: 603, title: 'The Matrix', year: 1999 }).run();
	const [night] = db
		.insert(nights)
		.values({ title: 'Friday', createdBy: owner.id })
		.returning()
		.all();
	return { owner, night };
}

describe('database', () => {
	it('applies migrations and applies column defaults', () => {
		const db = freshDb();
		const { owner, night } = seed(db);

		expect(owner.role).toBe('owner');
		expect(night.status).toBe('draft');
		expect(night.maxVotes).toBe(3);
		expect(night.resultsHidden).toBe(true);
	});

	it('rejects nominating the same movie twice in one night', () => {
		const db = freshDb();
		const { owner, night } = seed(db);
		const nominate = () =>
			db.insert(nominations).values({ nightId: night.id, tmdbId: 603, userId: owner.id }).run();

		nominate();
		expect(nominate).toThrow(/UNIQUE/);
	});

	it('cascades watchlist rows when a user is deleted', () => {
		const db = freshDb();
		const { owner } = seed(db);
		db.insert(watchlist).values({ userId: owner.id, tmdbId: 603 }).run();

		db.delete(nights).run();
		db.delete(users).where(eq(users.id, owner.id)).run();

		expect(db.select().from(watchlist).all()).toHaveLength(0);
	});
});
