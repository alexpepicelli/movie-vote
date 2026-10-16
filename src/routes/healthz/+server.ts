import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { checkDatabase, checkService, SERVICE_CHECKS } from '#lib/server/health.js';
import { configFor } from '#lib/server/integrations.js';
import type { RequestHandler } from './$types';

/**
 * Liveness: 200 while the database is usable (used by the Docker healthcheck).
 * Owner only: add ?deep to also probe Seerr and Radarr; their failures are reported but don't fail the check.
 */
export const GET: RequestHandler = async ({ url, fetch, locals }) => {
	const database = checkDatabase(db);
	const body: Record<string, unknown> = { database };

	if (url.searchParams.has('deep') && locals.user?.role === 'owner') {
		const [seerr, radarr] = await Promise.all(
			(['seerr', 'radarr'] as const).map((service) => {
				const { url, apiKey } = configFor(service);
				return checkService({ url, apiKey, statusPath: SERVICE_CHECKS[service] }, fetch);
			})
		);
		body.seerr = seerr;
		body.radarr = radarr;
	}

	return json(body, {
		status: database.status === 'ok' ? 200 : 503,
		headers: { 'Cache-Control': 'no-store' }
	});
};
