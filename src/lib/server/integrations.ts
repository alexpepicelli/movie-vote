import { RADARR_API_KEY, RADARR_URL, SEERR_API_KEY, SEERR_URL } from '$app/env/private';
import { db } from './db/index';
import { SeerrClient } from './seerr';
import { RadarrClient } from './radarr';
import { serviceConfig, type Fallbacks, type Service } from './settings';

/** Env vars are optional: they only apply when nothing has been saved in Settings. */
export const envFallbacks: Fallbacks = {
	seerr: { url: SEERR_URL, apiKey: SEERR_API_KEY },
	radarr: { url: RADARR_URL, apiKey: RADARR_API_KEY }
};

export const configFor = (service: Service) => serviceConfig(db, service, envFallbacks);

let cache: { seerr: SeerrClient | null; radarr: RadarrClient | null } | null = null;

function clients() {
	if (!cache) {
		const s = configFor('seerr');
		const r = configFor('radarr');
		cache = {
			seerr: s.apiKey ? new SeerrClient(s.url, s.apiKey) : null,
			radarr: r.apiKey ? new RadarrClient(r.url, r.apiKey) : null
		};
	}
	return cache;
}

/** Seerr client, or null until an API key is set. */
export const getSeerr = () => clients().seerr;
/** Radarr client, or null until an API key is set. */
export const getRadarr = () => clients().radarr;
/** Seerr sign-in only needs the URL, not the API key. */
export const seerrUrl = () => configFor('seerr').url;

/** Call after saving settings so the next request uses the new connection. */
export function invalidateIntegrations() {
	cache = null;
}
