import { RADARR_API_KEY, RADARR_URL, SEERR_API_KEY, SEERR_URL } from '$app/env/private';
import { SeerrClient } from './seerr';
import { RadarrClient } from './radarr';

/** Configured clients, or null when the URL/key isn't set. */
export const seerr = SEERR_URL && SEERR_API_KEY ? new SeerrClient(SEERR_URL, SEERR_API_KEY) : null;
export const radarr =
	RADARR_URL && RADARR_API_KEY ? new RadarrClient(RADARR_URL, RADARR_API_KEY) : null;
