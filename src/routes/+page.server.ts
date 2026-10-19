import { db } from '#lib/server/db/index.js';
import { nightChanged } from '#lib/server/events.js';
import { advanceDueNights, currentNight, nightView, ratingPrompt } from '#lib/server/nights.js';
import { mostWanted, watchlistIds } from '#lib/server/watchlist.js';
import { getRadarr, getSeerr } from '#lib/server/integrations.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	depends('votarr:nights');
	const userId = locals.user!.id;
	advanceDueNights(db).forEach((t) => nightChanged(t.nightId));
	const night = currentNight(db);
	const view = night ? nightView(db, night, userId) : null;
	const saved = watchlistIds(db, userId);

	return {
		night: view && {
			id: view.night.id,
			title: view.night.title,
			theme: view.night.theme,
			status: view.night.status,
			scheduledFor: view.night.scheduledFor,
			nominateUntil: view.night.nominateUntil,
			voteUntil: view.night.voteUntil,
			nominationCount: view.entries.length,
			nominationsLeft: view.night.maxNominations - view.myNominationCount,
			votesLeft: view.night.maxVotes - view.myVoteCount,
			maxVotes: view.night.maxVotes,
			voterCount: view.voterCount,
			memberCount: view.memberCount,
			people: view.people,
			// Sorted by id rather than rank, so the grid doesn't give the winner away.
			ballot: [...view.entries]
				.sort((a, b) => a.movie.tmdbId - b.movie.tmdbId)
				.map((e) => ({ movie: e.movie, nominatedBy: e.mine ? 'you' : e.nominatedBy })),
			winner: view.night.status === 'closed' ? (view.entries[0]?.movie ?? null) : null
		},
		rateNight: ratingPrompt(db, userId),
		needsConnecting: locals.user!.role === 'owner' && (!getSeerr() || !getRadarr()),
		myCount: saved.size,
		mostWanted: mostWanted(db, 6).map((m) => ({
			movie: m.movie,
			wantCount: m.wantCount,
			mine: saved.has(m.movie.tmdbId)
		}))
	};
};
