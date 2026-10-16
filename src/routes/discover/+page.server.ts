import { db } from '#lib/server/db/index.js';
import { seerr } from '#lib/server/integrations.js';
import { withCachedStatus } from '#lib/server/movies.js';
import { SeerrError } from '#lib/server/seerr.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const page = Math.max(1, Math.min(50, Number(url.searchParams.get('page')) || 1));

	if (!seerr) return { q, configured: false as const };

	try {
		if (q) {
			const results = await seerr.search(q, page);
			return {
				q,
				configured: true as const,
				search: { ...results, results: withCachedStatus(db, results.results) }
			};
		}
		const [trending, popular] = await Promise.all([seerr.trending(), seerr.popular()]);
		return {
			q,
			configured: true as const,
			rows: [
				{ title: 'Trending this week', movies: withCachedStatus(db, trending.results) },
				{ title: 'Popular', movies: withCachedStatus(db, popular.results) }
			]
		};
	} catch (e) {
		const message = e instanceof SeerrError ? e.message : 'Something went wrong talking to Seerr.';
		return { q, configured: true as const, error: message };
	}
};
