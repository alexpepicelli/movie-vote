import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { nightChanged } from '#lib/server/events.js';
import { getSeerr } from '#lib/server/integrations.js';
import { getMovie, withCachedStatus } from '#lib/server/movies.js';
import {
	advanceDueNights,
	cancelNight,
	castVote,
	closeVoting,
	getNight,
	joinNight,
	leaveNight,
	markWatched,
	MAX_COMMENT,
	nightRatings,
	rate,
	nightView,
	nominate,
	nominationPicker,
	removeVote,
	setTheme,
	startVoting,
	withdraw,
	type Result
} from '#lib/server/nights.js';
import { requestMovie } from '#lib/server/requests.js';
import { SeerrError } from '#lib/server/seerr.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url, depends }) => {
	depends('votarr:nights');
	advanceDueNights(db).forEach((t) => nightChanged(t.nightId));
	const night = getNight(db, params.id);
	if (!night) error(404, 'Movie night not found');

	const seerr = getSeerr();
	const userId = locals.user!.id;
	const view = nightView(db, night, userId);
	if (night.status !== 'nominating')
		return {
			...view,
			picker: null,
			ratings: night.status === 'watched' ? nightRatings(db, night.id, userId) : null,
			canRequest: !!seerr,
			maxComment: MAX_COMMENT
		};

	// Nominating: offer your watchlist first, then what friends want, then search.
	const { mine, group, nominated } = nominationPicker(db, night.id, userId);
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	let search: { results: ReturnType<typeof withCachedStatus>; error?: string } | null = null;
	if (q && seerr) {
		try {
			const page = await seerr.search(q);
			search = {
				results: withCachedStatus(
					db,
					page.results.filter((r) => !nominated.has(r.tmdbId))
				)
			};
		} catch (e) {
			search = { results: [], error: e instanceof SeerrError ? e.message : 'Search failed.' };
		}
	}
	return {
		...view,
		picker: { mine, group, q, search, searchEnabled: !!seerr },
		ratings: null,
		canRequest: !!seerr,
		maxComment: MAX_COMMENT
	};
};

const field = async (request: Request, name: string) =>
	String((await request.formData()).get(name) ?? '');

/** Tells everyone watching this night to reload when something changed. */
const respond = (nightId: string, result: Result) => {
	if (!result.ok) return fail(400, { error: result.error });
	nightChanged(nightId);
	return { ok: true };
};

function requireOwner(locals: App.Locals) {
	if (locals.user?.role !== 'owner') error(403, 'Only the owner can do that.');
}

export const actions: Actions = {
	nominate: async ({ request, params, locals }) => {
		const tmdbId = Number(await field(request, 'tmdbId'));
		if (!Number.isInteger(tmdbId) || tmdbId <= 0) return fail(400, { error: 'Invalid movie.' });
		try {
			if (!(await getMovie(db, getSeerr(), tmdbId)))
				return fail(404, { error: 'Movie not found.' });
		} catch {
			return fail(503, { error: "Can't reach Seerr right now. Try again shortly." });
		}
		return respond(params.id, nominate(db, params.id, locals.user!.id, tmdbId));
	},
	withdraw: async ({ request, params, locals }) =>
		respond(params.id, withdraw(db, params.id, await field(request, 'nominationId'), locals.user!)),

	/** `value` is "down" for a downvote; anything else is an upvote. */
	vote: async ({ request, params, locals }) => {
		const form = await request.formData();
		const value = form.get('value') === 'down' ? -1 : 1;
		return respond(
			params.id,
			castVote(db, params.id, locals.user!.id, String(form.get('nominationId') ?? ''), value)
		);
	},
	unvote: async ({ request, params, locals }) =>
		respond(
			params.id,
			removeVote(db, params.id, locals.user!.id, await field(request, 'nominationId'))
		),

	attend: ({ params, locals }) => respond(params.id, joinNight(db, params.id, locals.user!.id)),
	unattend: ({ params, locals }) => respond(params.id, leaveNight(db, params.id, locals.user!.id)),

	startVoting: ({ params, locals }) => {
		requireOwner(locals);
		return respond(params.id, startVoting(db, params.id));
	},
	close: ({ params, locals }) => {
		requireOwner(locals);
		return respond(params.id, closeVoting(db, params.id));
	},
	request: async ({ params, locals }) => {
		requireOwner(locals);
		const night = getNight(db, params.id);
		if (!night?.winnerTmdbId) return fail(400, { error: 'There’s no winner to request.' });
		const result = await requestMovie(db, getSeerr(), night.winnerTmdbId, locals.user!.id);
		if (!result.ok) return fail(502, { error: result.error });
		nightChanged(night.id);
		return { requested: true, already: result.already };
	},
	markWatched: ({ params, locals }) => {
		requireOwner(locals);
		return respond(params.id, markWatched(db, params.id));
	},
	rate: async ({ request, params, locals }) => {
		const form = await request.formData();
		return respond(
			params.id,
			rate(
				db,
				params.id,
				locals.user!.id,
				Number(form.get('score')),
				String(form.get('comment') ?? '')
			)
		);
	},
	setTheme: async ({ params, locals, request }) => {
		requireOwner(locals);
		const form = await request.formData();
		const result = setTheme(db, params.id, String(form.get('theme') ?? ''));
		if (!result.ok) return fail(400, { error: result.error });
		nightChanged(params.id);
		return { ok: true };
	},
	cancel: ({ params, locals }) => {
		requireOwner(locals);
		const result = cancelNight(db, params.id);
		if (!result.ok) return fail(400, { error: result.error });
		nightChanged(params.id);
		redirect(303, '/');
	}
};
