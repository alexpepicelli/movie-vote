/**
 * Fills a throwaway database with a movie night at a chosen stage, for looking at the UI.
 *
 *   npm run mock -- nominating|voting|results|watched [theme]
 *
 * Wipes everything but the people and their sign-ins first, so switching stage keeps you logged in. Sign in as `alex` with password `mockpass` (local test account).
 * Only ever point this at a scratch file: it deletes everything.
 */
import { eq } from 'drizzle-orm';
import { openDatabase, runMigrations } from '../src/lib/server/db/client';
import * as s from '../src/lib/server/db/schema';
import { hashPassword } from '../src/lib/server/auth/password';
import {
	castVote,
	closeVoting,
	createNight,
	joinNight,
	markWatched,
	nominate,
	rate,
	startVoting,
	type NightInput
} from '../src/lib/server/nights';

const path = process.env.DATABASE_URL ?? './data/mock.db';
if (!/mock/.test(path))
	throw new Error(`Refusing to wipe ${path}: the file name must contain "mock".`);
const phase = process.argv[2] ?? 'nominating';
const theme = process.argv[3] ?? 'synthwave';
if (!['nominating', 'voting', 'results', 'watched'].includes(phase))
	throw new Error('Phase must be nominating, voting, results or watched.');

const db = openDatabase(path);
runMigrations(db);
for (const t of [
	s.auditLog,
	s.ratings,
	s.attendance,
	s.votes,
	s.nominations,
	s.nights,
	s.watchlist,
	s.movies,
	s.invites
])
	db.delete(t).run();

const DAY = 86_400_000;
const now = Date.now();
const at = (days: number, hour = 19, min = 30) => {
	const d = new Date(now + days * DAY);
	d.setHours(hour, min, 0, 0);
	return d;
};

// ── People
const people = [
	['alex', 'Alex', 'owner'],
	['sam', 'Sam', 'member'],
	['jess', 'Jess', 'member'],
	['priya', 'Priya', 'member'],
	['marcus', 'Marcus', 'member']
] as const;
const passwordHash = await hashPassword('mockpass');
const user: Record<string, string> = {};
for (const [username, displayName, role] of people) {
	const existing = db.select().from(s.users).where(eq(s.users.username, username)).get();
	const row =
		existing ??
		db
			.insert(s.users)
			.values({ authKind: 'local', username, displayName, role, passwordHash })
			.returning()
			.get();
	user[username] = row.id;
}

// ── Movies (real TMDB ids and poster paths so artwork loads)
const M = {
	dune: [
		693134,
		'Dune: Part Two',
		2024,
		166,
		['Science Fiction', 'Adventure'],
		82,
		'/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg'
	],
	bladerunner: [
		335984,
		'Blade Runner 2049',
		2017,
		164,
		['Science Fiction', 'Drama'],
		76,
		'/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg'
	],
	matrix: [
		603,
		'The Matrix',
		1999,
		136,
		['Action', 'Science Fiction'],
		82,
		'/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg'
	],
	spiderverse: [
		324857,
		'Spider-Man: Into the Spider-Verse',
		2018,
		117,
		['Animation', 'Action'],
		84,
		'/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg'
	],
	madmax: [
		76341,
		'Mad Max: Fury Road',
		2015,
		121,
		['Action', 'Adventure'],
		76,
		'/hA2ple9q4qnwxp3hKVNhroipsir.jpg'
	],
	bttf: [
		105,
		'Back to the Future',
		1985,
		116,
		['Adventure', 'Comedy'],
		85,
		'/fNOH9f1aA7XRTzl1sAOx9iF553Q.jpg'
	],
	eeaao: [
		545611,
		'Everything Everywhere All at Once',
		2022,
		139,
		['Action', 'Comedy'],
		79,
		'/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg'
	],
	interstellar: [
		157336,
		'Interstellar',
		2014,
		169,
		['Adventure', 'Drama'],
		87,
		'/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
	],
	drive: [64690, 'Drive', 2011, 100, ['Crime', 'Drama'], 76, '/602vevIURmpDfzbnv5Ubi6wIkQm.jpg'],
	tron: [
		20526,
		'TRON: Legacy',
		2010,
		125,
		['Science Fiction', 'Action'],
		63,
		'/vOipe2myi26UDwP978hsYOrnUWC.jpg'
	]
} as const;
type Film = keyof typeof M;
const id = (k: Film) => M[k][0];
for (const [tmdbId, title, year, runtime, genres, rating, posterPath] of Object.values(M))
	db.insert(s.movies)
		.values({
			tmdbId,
			title,
			year,
			runtime,
			genres: [...genres],
			tmdbRating: rating,
			posterPath,
			overview: 'A mock film for previewing the layout.',
			seerrStatus: tmdbId % 3 === 0 ? 'available' : 'none',
			radarrStatus: tmdbId % 3 === 0 ? 'available' : null
		})
		.run();

// ── Watchlists (feeds the picker and "friends want these")
const wants: Record<string, Film[]> = {
	alex: ['eeaao', 'interstellar', 'drive', 'tron'],
	sam: ['dune', 'tron', 'drive'],
	jess: ['bladerunner', 'eeaao'],
	priya: ['spiderverse', 'interstellar'],
	marcus: ['matrix', 'madmax']
};
for (const [u, list] of Object.entries(wants))
	for (const m of list)
		db.insert(s.watchlist)
			.values({ userId: user[u], tmdbId: id(m) })
			.run();

const ok = (r: { ok: boolean; error?: string }) => {
	if (!r.ok) throw new Error(r.error);
};
const input = (over: Partial<NightInput>): NightInput => ({
	title: 'Friday Night Flicks',
	theme,
	scheduledFor: at(3),
	nominateUntil: at(1),
	voteUntil: at(2),
	maxNominations: 2,
	maxVotes: 3,
	selfVoteAllowed: false,
	secretBallot: false,
	...over
});

/** A finished night in the past, created with a back-dated clock. */
function pastNight(
	title: string,
	daysAgo: number,
	picks: [string, Film][],
	winner: Film,
	scores: Record<string, number>
) {
	const then = new Date(now - daysAgo * DAY);
	const r = createNight(
		db,
		user.alex,
		input({ title, scheduledFor: then, nominateUntil: null, voteUntil: null }),
		new Date(then.getTime() - 5 * DAY)
	);
	if (!r.ok) throw new Error(r.error);
	const n = r.night;
	for (const [u, m] of picks) ok(nominate(db, n.id, user[u], id(m)));
	ok(startVoting(db, n.id, new Date(then.getTime() - 3 * DAY)));
	const noms = db.select().from(s.nominations).where(eq(s.nominations.nightId, n.id)).all();
	const w = noms.find((x) => x.tmdbId === id(winner))!;
	for (const u of ['sam', 'jess', 'priya', 'marcus'])
		if (user[u] !== w.userId) ok(castVote(db, n.id, user[u], w.id, 1));
	ok(closeVoting(db, n.id, new Date(then.getTime() - 2 * DAY), 'seed'));
	ok(markWatched(db, n.id, then));
	for (const [u, score] of Object.entries(scores)) ok(rate(db, n.id, user[u], score, null));
}

if (phase === 'watched') {
	pastNight(
		'Sci-fi Sunday',
		21,
		[
			['sam', 'matrix'],
			['jess', 'madmax']
		],
		'matrix',
		{
			sam: 5,
			jess: 4,
			priya: 4,
			marcus: 5
		}
	);
	pastNight(
		'Animated Night',
		10,
		[
			['priya', 'spiderverse'],
			['marcus', 'bttf']
		],
		'spiderverse',
		{
			sam: 5,
			jess: 5,
			priya: 5
		}
	);
}

// ── The night itself
const created = createNight(
	db,
	user.alex,
	input({
		title:
			phase === 'watched'
				? 'Neon Nights'
				: theme === 'halloween'
					? 'Spooky Saturday'
					: theme === 'christmas'
						? 'Christmas Eve'
						: 'Friday Night Flicks',
		scheduledFor: at(phase === 'watched' ? -1 : 3)
	}),
	new Date(now - 5 * DAY)
);
if (!created.ok) throw new Error(created.error);
const night = created.night;

const picks: [string, Film][] = [
	['sam', 'dune'],
	['sam', 'bladerunner'],
	['jess', 'matrix'],
	['priya', 'spiderverse'],
	...(phase === 'nominating'
		? []
		: ([
				['alex', 'madmax'],
				['marcus', 'interstellar']
			] as [string, Film][]))
];
for (const [u, m] of picks) ok(nominate(db, night.id, user[u], id(m)));
for (const u of ['sam', 'jess', 'priya']) ok(joinNight(db, night.id, user[u]));

if (phase !== 'nominating') {
	ok(startVoting(db, night.id));
	const noms = db.select().from(s.nominations).where(eq(s.nominations.nightId, night.id)).all();
	const nom = (m: Film) => noms.find((n) => n.tmdbId === id(m))!.id;
	const ballots: [string, Film, 1 | -1][] = [
		['sam', 'matrix', 1],
		['sam', 'spiderverse', 1],
		['sam', 'madmax', -1],
		['jess', 'dune', 1],
		['jess', 'interstellar', 1],
		['jess', 'madmax', -1],
		['priya', 'dune', 1],
		['priya', 'bladerunner', 1],
		['priya', 'madmax', 1],
		['marcus', 'dune', 1],
		['marcus', 'spiderverse', 1]
	];
	for (const [u, m, v] of ballots) ok(castVote(db, night.id, user[u], nom(m), v));
	// In the voting phase you (alex) have only used one of your three votes so far.
	ok(castVote(db, night.id, user.alex, nom('dune'), 1));
	if (phase === 'results' || phase === 'watched') {
		ok(castVote(db, night.id, user.alex, nom('matrix'), 1));
		ok(closeVoting(db, night.id, new Date(), 'seed'));
	}
	if (phase === 'watched') {
		ok(markWatched(db, night.id));
		ok(rate(db, night.id, user.sam, 5, 'Worth the wait.'));
		ok(rate(db, night.id, user.jess, 4, null));
		ok(rate(db, night.id, user.priya, 5, 'Sandworms!'));
	}
}
console.log(`Seeded "${phase}" into ${path}. Sign in as alex / mockpass.`);
