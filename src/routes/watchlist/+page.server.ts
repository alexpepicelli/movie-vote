import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { seerr } from '#lib/server/integrations.js';
import { getMovie } from '#lib/server/movies.js';
import {
	addToWatchlist,
	mostWanted,
	myWatchlist,
	removeFromWatchlist
} from '#lib/server/watchlist.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const tab = url.searchParams.get('tab') === 'group' ? 'group' : 'mine';
	const userId = locals.user!.id;
	return {
		tab,
		mine: myWatchlist(db, userId),
		group: mostWanted(db).map((m) => ({
			...m,
			mine: m.wantedBy.some((p) => p.id === userId)
		}))
	};
};

async function tmdbIdFrom(request: Request) {
	const id = Number((await request.formData()).get('tmdbId'));
	if (!Number.isInteger(id) || id <= 0) error(400, 'Invalid movie');
	return id;
}

// Posted to from movie cards and detail pages anywhere in the app.
export const actions: Actions = {
	add: async ({ request, locals }) => {
		const tmdbId = await tmdbIdFrom(request);
		let movie;
		try {
			movie = await getMovie(db, seerr, tmdbId); // makes sure it's cached
		} catch {
			return fail(503, { tmdbId, error: "Can't reach Seerr right now. Try again shortly." });
		}
		if (!movie) return fail(404, { tmdbId, error: 'Movie not found.' });

		addToWatchlist(db, locals.user!.id, tmdbId);
		return { tmdbId, added: true };
	},
	remove: async ({ request, locals }) => {
		const tmdbId = await tmdbIdFrom(request);
		removeFromWatchlist(db, locals.user!.id, tmdbId);
		return { tmdbId, added: false };
	}
};
