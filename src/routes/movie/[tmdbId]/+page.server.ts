import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { movies } from '#lib/server/db/schema.js';
import { getRadarr, getSeerr } from '#lib/server/integrations.js';
import { getMovie, refreshStatuses, statusIsStale } from '#lib/server/movies.js';
import { requestMovie } from '#lib/server/requests.js';
import { wantedBy } from '#lib/server/watchlist.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const tmdbId = Number(params.tmdbId);
	if (!Number.isInteger(tmdbId) || tmdbId <= 0) error(404, 'Movie not found');

	const seerr = getSeerr();
	const radarr = getRadarr();
	let movie;
	try {
		movie = await getMovie(db, seerr, tmdbId);
	} catch {
		error(503, "Can't reach Seerr right now. Try again shortly.");
	}
	if (!movie) error(404, 'Movie not found');

	// Detail pages show live Radarr status; failures just leave the cached status.
	if (radarr && statusIsStale(movie)) {
		await refreshStatuses(db, radarr, [tmdbId]).catch(() => {});
		movie = db.select().from(movies).where(eq(movies.tmdbId, tmdbId)).get() ?? movie;
	}

	const wanters = wantedBy(db, [tmdbId]).get(tmdbId) ?? [];
	return {
		movie,
		wanters,
		onMyWatchlist: wanters.some((p) => p.id === locals.user!.id),
		canRequest: !!seerr
	};
};

export const actions: Actions = {
	request: async ({ params, locals }) => {
		if (locals.user?.role !== 'owner') error(403, 'Only the owner can request movies.');
		const result = await requestMovie(db, getSeerr(), Number(params.tmdbId), locals.user.id);
		return result.ok
			? { requested: true, already: result.already }
			: fail(502, { error: result.error });
	}
};
