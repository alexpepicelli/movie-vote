import { json } from '@sveltejs/kit';
import { RADARR_API_KEY, RADARR_URL, SEERR_API_KEY, SEERR_URL } from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import { checkDatabase, checkService } from '#lib/server/health.js';
import type { RequestHandler } from './$types';

/**
 * Liveness: 200 while the database is usable (used by the Docker healthcheck).
 * Owner only: add ?deep to also probe Seerr and Radarr; their failures are reported but don't fail the check.
 */
export const GET: RequestHandler = async ({ url, fetch, locals }) => {
	const database = checkDatabase(db);
	const body: Record<string, unknown> = { database };

	if (url.searchParams.has('deep') && locals.user?.role === 'owner') {
		const [seerr, radarr] = await Promise.all([
			checkService({ url: SEERR_URL, apiKey: SEERR_API_KEY, statusPath: '/api/v1/status' }, fetch),
			checkService(
				{ url: RADARR_URL, apiKey: RADARR_API_KEY, statusPath: '/api/v3/system/status' },
				fetch
			)
		]);
		body.seerr = seerr;
		body.radarr = radarr;
	}

	return json(body, {
		status: database.status === 'ok' ? 200 : 503,
		headers: { 'Cache-Control': 'no-store' }
	});
};
