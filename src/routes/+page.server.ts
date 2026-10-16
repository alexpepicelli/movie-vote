import { db } from '#lib/server/db/index.js';
import { mostWanted, watchlistIds } from '#lib/server/watchlist.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const saved = watchlistIds(db, locals.user!.id);
	return {
		myCount: saved.size,
		mostWanted: mostWanted(db, 10).map((m) => ({
			movie: m.movie,
			wantCount: m.wantCount,
			mine: saved.has(m.movie.tmdbId)
		}))
	};
};
