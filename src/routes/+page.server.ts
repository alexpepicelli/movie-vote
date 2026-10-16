import { db } from '#lib/server/db/index.js';
import { advanceDueNights, currentNight, nightView, ratingPrompt } from '#lib/server/nights.js';
import { mostWanted, watchlistIds } from '#lib/server/watchlist.js';
import { getRadarr, getSeerr } from '#lib/server/integrations.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const userId = locals.user!.id;
	advanceDueNights(db);
	const night = currentNight(db);
	const view = night ? nightView(db, night, userId) : null;
	const saved = watchlistIds(db, userId);

	return {
		night: view && {
			id: view.night.id,
			title: view.night.title,
			status: view.night.status,
			scheduledFor: view.night.scheduledFor,
			nominateUntil: view.night.nominateUntil,
			voteUntil: view.night.voteUntil,
			nominationCount: view.entries.length,
			nominationsLeft: view.night.maxNominations - view.myNominationCount,
			votesLeft: view.night.maxVotes - view.myVoteCount,
			voterCount: view.voterCount,
			memberCount: view.memberCount,
			// Sorted by id rather than rank, so the fan of posters doesn't give the winner away.
			posters: [...view.entries]
				.sort((a, b) => a.movie.tmdbId - b.movie.tmdbId)
				.slice(0, 5)
				.map((e) => e.movie.posterPath),
			winner: view.night.status === 'closed' ? (view.entries[0]?.movie ?? null) : null
		},
		rateNight: ratingPrompt(db, userId),
		needsConnecting: locals.user!.role === 'owner' && (!getSeerr() || !getRadarr()),
		myCount: saved.size,
		mostWanted: mostWanted(db, 10).map((m) => ({
			movie: m.movie,
			wantCount: m.wantCount,
			mine: saved.has(m.movie.tmdbId)
		}))
	};
};
