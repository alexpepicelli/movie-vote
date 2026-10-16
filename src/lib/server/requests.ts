import { eq } from 'drizzle-orm';
import type { Db } from './db/client';
import { auditLog, movies } from './db/schema';
import { SeerrError, type SeerrClient } from './seerr';

export type RequestResult = { ok: true; already: boolean } | { ok: false; error: string };

/** Owner-only: asks Seerr to fetch a movie, marks it requested locally, and logs who did it. */
export async function requestMovie(
	db: Db,
	seerr: SeerrClient | null,
	tmdbId: number,
	userId: string
): Promise<RequestResult> {
	if (!seerr) return { ok: false, error: "Seerr isn't connected, so movies can't be requested." };

	let outcome: 'requested' | 'already_requested';
	try {
		outcome = await seerr.request(tmdbId);
	} catch (e) {
		const reason = e instanceof SeerrError ? e.message : 'Something went wrong.';
		return { ok: false, error: `Seerr couldn't request it: ${reason}` };
	}

	db.transaction((tx) => {
		tx.update(movies)
			.set({ seerrStatus: 'pending', statusRefreshedAt: null }) // re-poll Radarr soon
			.where(eq(movies.tmdbId, tmdbId))
			.run();
		tx.insert(auditLog)
			.values({ userId, action: 'request_movie', payload: { tmdbId, outcome } })
			.run();
	});
	return { ok: true, already: outcome === 'already_requested' };
}
