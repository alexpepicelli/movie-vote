import { db } from '#lib/server/db/index.js';
import { getSeerr } from '#lib/server/integrations.js';
import { withCachedStatus } from '#lib/server/movies.js';
import { SeerrError } from '#lib/server/seerr.js';
import { mostWanted, myWatchlist, watchlistIds } from '#lib/server/watchlist.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const tab =
		url.searchParams.get('tab') === 'mine'
			? 'mine'
			: url.searchParams.get('tab') === 'group'
				? 'group'
				: 'browse';
	const sort =
		url.searchParams.get('sort') === 'title'
			? 'title'
			: url.searchParams.get('sort') === 'year'
				? 'year'
				: 'default';
	const page = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get('page')) || 1)));
	const userId = locals.user!.id;
	const mine = myWatchlist(db, userId);
	const group = mostWanted(db, 1000).map((m) => ({
		...m,
		mine: m.wantedBy.some((p) => p.id === userId)
	}));
	const matches = (title: string) => title.toLocaleLowerCase().includes(q.toLocaleLowerCase());
	const order = (
		a: { movie: { title: string; year: number | null } },
		b: { movie: { title: string; year: number | null } }
	) =>
		sort === 'title'
			? a.movie.title.localeCompare(b.movie.title)
			: sort === 'year'
				? (b.movie.year ?? 0) - (a.movie.year ?? 0)
				: 0;
	const seerr = getSeerr();
	const common = {
		q,
		tab,
		sort,
		saved: [...watchlistIds(db, userId)],
		configured: !!seerr,
		mineCount: mine.length,
		mine: tab === 'mine' ? mine.filter((m) => matches(m.movie.title)).sort(order) : mine,
		group: tab === 'group' ? group.filter((m) => matches(m.movie.title)).sort(order) : group
	};
	if (tab !== 'browse' || !seerr) return common;
	try {
		if (q) {
			const results = await seerr.search(q, page);
			return { ...common, search: { ...results, results: withCachedStatus(db, results.results) } };
		}
		const feeds = await Promise.allSettled([seerr.trending(), seerr.popular()]);
		const rows = feeds.flatMap((feed, i) =>
			feed.status === 'fulfilled'
				? [
						{
							title: i === 0 ? 'Trending this week' : 'Popular right now',
							movies: withCachedStatus(db, feed.value.results)
						}
					]
				: []
		);
		return {
			...common,
			rows,
			error:
				rows.length < 2
					? 'Some movie collections are unavailable. Your saved films are still here. Try again shortly.'
					: undefined
		};
	} catch (e) {
		return {
			...common,
			error: e instanceof SeerrError ? e.message : 'Could not load movies. Try again shortly.'
		};
	}
};
