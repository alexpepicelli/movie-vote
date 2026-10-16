import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { seerr } from '#lib/server/integrations.js';
import { getMovie, withCachedStatus } from '#lib/server/movies.js';
import {
	advanceDueNights,
	cancelNight,
	castVote,
	closeVoting,
	getNight,
	nightView,
	nominate,
	nominationPicker,
	removeVote,
	startVoting,
	withdraw,
	type Result
} from '#lib/server/nights.js';
import { SeerrError } from '#lib/server/seerr.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	advanceDueNights(db);
	const night = getNight(db, params.id);
	if (!night) error(404, 'Movie night not found');

	const userId = locals.user!.id;
	const view = nightView(db, night, userId);
	if (night.status !== 'nominating') return { ...view, picker: null };

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
	return { ...view, picker: { mine, group, q, search, searchEnabled: !!seerr } };
};

const field = async (request: Request, name: string) =>
	String((await request.formData()).get(name) ?? '');

const respond = (result: Result) => (result.ok ? { ok: true } : fail(400, { error: result.error }));

function requireOwner(locals: App.Locals) {
	if (locals.user?.role !== 'owner') error(403, 'Only the owner can do that.');
}

export const actions: Actions = {
	nominate: async ({ request, params, locals }) => {
		const tmdbId = Number(await field(request, 'tmdbId'));
		if (!Number.isInteger(tmdbId) || tmdbId <= 0) return fail(400, { error: 'Invalid movie.' });
		try {
			if (!(await getMovie(db, seerr, tmdbId))) return fail(404, { error: 'Movie not found.' });
		} catch {
			return fail(503, { error: "Can't reach Seerr right now. Try again shortly." });
		}
		return respond(nominate(db, params.id, locals.user!.id, tmdbId));
	},
	withdraw: async ({ request, params, locals }) =>
		respond(withdraw(db, params.id, await field(request, 'nominationId'), locals.user!)),

	vote: async ({ request, params, locals }) =>
		respond(castVote(db, params.id, locals.user!.id, await field(request, 'nominationId'))),
	unvote: async ({ request, params, locals }) =>
		respond(removeVote(db, params.id, locals.user!.id, await field(request, 'nominationId'))),

	startVoting: ({ params, locals }) => {
		requireOwner(locals);
		return respond(startVoting(db, params.id));
	},
	close: ({ params, locals }) => {
		requireOwner(locals);
		return respond(closeVoting(db, params.id));
	},
	cancel: ({ params, locals }) => {
		requireOwner(locals);
		const result = cancelNight(db, params.id);
		if (!result.ok) return fail(400, { error: result.error });
		redirect(303, '/');
	}
};
