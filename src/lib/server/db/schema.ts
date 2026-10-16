import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import type { TallyResult } from '../tally';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`);

export const users = sqliteTable('users', {
	id: id(),
	authKind: text('auth_kind', { enum: ['seerr', 'local'] }).notNull(),
	seerrUserId: integer('seerr_user_id').unique(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash'),
	displayName: text('display_name').notNull(),
	avatarUrl: text('avatar_url'),
	role: text('role', { enum: ['owner', 'member'] })
		.notNull()
		.default('member'),
	createdAt: createdAt()
});

export const invites = sqliteTable('invites', {
	code: text('code').primaryKey(),
	createdBy: text('created_by')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
	usedAt: integer('used_at', { mode: 'timestamp' })
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const movies = sqliteTable('movies', {
	tmdbId: integer('tmdb_id').primaryKey(),
	title: text('title').notNull(),
	year: integer('year'),
	overview: text('overview'),
	posterPath: text('poster_path'),
	backdropPath: text('backdrop_path'),
	runtime: integer('runtime'),
	genres: text('genres', { mode: 'json' }).$type<string[]>(),
	tmdbRating: integer('tmdb_rating'), // rating × 10, e.g. 7.4 → 74
	trailerKey: text('trailer_key'),
	radarrStatus: text('radarr_status', {
		enum: ['available', 'downloading', 'monitored', 'missing']
	}),
	radarrProgress: integer('radarr_progress'), // 0–100
	seerrStatus: text('seerr_status', {
		enum: ['none', 'pending', 'processing', 'partial', 'available']
	}),
	metadataRefreshedAt: integer('metadata_refreshed_at', { mode: 'timestamp' }),
	statusRefreshedAt: integer('status_refreshed_at', { mode: 'timestamp' })
});

export const watchlist = sqliteTable(
	'watchlist',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tmdbId: integer('tmdb_id')
			.notNull()
			.references(() => movies.tmdbId),
		note: text('note'),
		addedAt: integer('added_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [primaryKey({ columns: [t.userId, t.tmdbId] }), index('watchlist_tmdb_idx').on(t.tmdbId)]
);

export const nightStatuses = ['draft', 'nominating', 'voting', 'closed', 'watched'] as const;

export const nights = sqliteTable('nights', {
	id: id(),
	title: text('title').notNull(),
	scheduledFor: integer('scheduled_for', { mode: 'timestamp' }),
	status: text('status', { enum: nightStatuses }).notNull().default('draft'),
	nominateUntil: integer('nominate_until', { mode: 'timestamp' }),
	voteUntil: integer('vote_until', { mode: 'timestamp' }),
	maxNominations: integer('max_nominations').notNull().default(2),
	maxVotes: integer('max_votes').notNull().default(3),
	selfVoteAllowed: integer('self_vote_allowed', { mode: 'boolean' }).notNull().default(false),
	/**
	 * Secret ballot: hides scores until voting closes and who voted for what for good.
	 * (Stored in the old results_hidden column; new nights always set it explicitly.)
	 */
	secretBallot: integer('results_hidden', { mode: 'boolean' }).notNull().default(true),
	winnerTmdbId: integer('winner_tmdb_id').references(() => movies.tmdbId),
	tiebreakSeed: text('tiebreak_seed'),
	/** Snapshot of the final ranking, taken when voting closes. */
	results: text('results', { mode: 'json' }).$type<TallyResult>(),
	votingStartedAt: integer('voting_started_at', { mode: 'timestamp' }),
	closedAt: integer('closed_at', { mode: 'timestamp' }),
	watchedAt: integer('watched_at', { mode: 'timestamp' }),
	createdBy: text('created_by')
		.notNull()
		.references(() => users.id),
	createdAt: createdAt()
});

export const nominations = sqliteTable(
	'nominations',
	{
		id: id(),
		nightId: text('night_id')
			.notNull()
			.references(() => nights.id, { onDelete: 'cascade' }),
		tmdbId: integer('tmdb_id')
			.notNull()
			.references(() => movies.tmdbId),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [unique('nominations_night_movie_uq').on(t.nightId, t.tmdbId)]
);

export const votes = sqliteTable(
	'votes',
	{
		nightId: text('night_id')
			.notNull()
			.references(() => nights.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		nominationId: text('nomination_id')
			.notNull()
			.references(() => nominations.id, { onDelete: 'cascade' }),
		/** +1 for an upvote, -1 for a downvote. Both use one of the night's votes. */
		value: integer('value').notNull().default(1),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.nightId, t.userId, t.nominationId] })]
);

/** Explicit "I'm in" taps. Nominating or voting also counts as going (see nights.ts). */
export const attendance = sqliteTable(
	'attendance',
	{
		nightId: text('night_id')
			.notNull()
			.references(() => nights.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		joinedAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.nightId, t.userId] })]
);

export const ratings = sqliteTable(
	'ratings',
	{
		nightId: text('night_id')
			.notNull()
			.references(() => nights.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		score: integer('score').notNull(), // 1–5 stars
		comment: text('comment'),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.nightId, t.userId] })]
);

export const auditLog = sqliteTable('audit_log', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
	action: text('action').notNull(),
	payload: text('payload', { mode: 'json' }),
	at: integer('at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

/** Owner-editable app settings (e.g. Seerr/Radarr connection), keyed by name. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});
