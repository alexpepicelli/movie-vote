import { eq, inArray } from 'drizzle-orm';
import type { Db } from './db/client';
import { settings } from './db/schema';

export type Service = 'seerr' | 'radarr';

/** Where YAMS (and most Docker setups) put these, reachable by container name. */
export const DEFAULT_URLS: Record<Service, string> = {
	seerr: 'http://seerr:5055',
	radarr: 'http://radarr:7878'
};

export type Fallbacks = Partial<Record<Service, { url?: string; apiKey?: string }>>;

export type ServiceConfig = {
	url: string;
	apiKey: string | undefined;
	urlSource: 'saved' | 'env' | 'default';
	keySource: 'saved' | 'env' | 'none';
};

const keyOf = (service: Service, field: 'url' | 'apiKey') => `${service}.${field}`;

/**
 * Effective connection settings: what the owner saved in Settings, else environment variables
 * (for anyone who prefers configuring through compose), else the YAMS defaults.
 */
export function serviceConfig(db: Db, service: Service, env: Fallbacks = {}): ServiceConfig {
	const rows = db
		.select()
		.from(settings)
		.where(inArray(settings.key, [keyOf(service, 'url'), keyOf(service, 'apiKey')]))
		.all();
	const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	const savedUrl = saved[keyOf(service, 'url')];
	const savedKey = saved[keyOf(service, 'apiKey')];
	const fallback = env[service] ?? {};

	return {
		url: savedUrl ?? fallback.url ?? DEFAULT_URLS[service],
		urlSource: savedUrl ? 'saved' : fallback.url ? 'env' : 'default',
		apiKey: savedKey ?? fallback.apiKey,
		keySource: savedKey ? 'saved' : fallback.apiKey ? 'env' : 'none'
	};
}

/** Returns an error message for a bad URL, else the normalised URL (no trailing slash). */
export function normaliseUrl(
	raw: string
): { ok: true; url: string } | { ok: false; error: string } {
	try {
		const u = new URL(raw.trim());
		if (u.protocol !== 'http:' && u.protocol !== 'https:')
			return { ok: false, error: 'The URL must start with http:// or https://' };
		return { ok: true, url: u.toString().replace(/\/+$/, '') };
	} catch {
		return { ok: false, error: 'That isn’t a valid URL, e.g. http://radarr:7878' };
	}
}

/**
 * Saves a service's URL and, if given, a new API key. An empty key keeps the saved one;
 * `clearKey` removes it.
 */
export function saveServiceConfig(
	db: Db,
	service: Service,
	input: { url: string; apiKey?: string; clearKey?: boolean },
	now = new Date()
) {
	const put = (key: string, value: string) =>
		db
			.insert(settings)
			.values({ key, value, updatedAt: now })
			.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
			.run();

	db.transaction(() => {
		put(keyOf(service, 'url'), input.url);
		if (input.clearKey)
			db.delete(settings)
				.where(eq(settings.key, keyOf(service, 'apiKey')))
				.run();
		else if (input.apiKey) put(keyOf(service, 'apiKey'), input.apiKey.trim());
	});
}

/** "…a1b2": enough to recognise a key without revealing it. */
export const maskKey = (key: string | undefined) => (key ? `…${key.slice(-4)}` : null);
