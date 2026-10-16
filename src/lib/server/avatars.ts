/**
 * Where to fetch a user's avatar from. Seerr stores Jellyfin avatars as paths on itself
 * (usually an internal address friends can't reach), and Gravatar ones as full URLs.
 */
export function avatarSource(avatarUrl: string | null, seerrBase: string | undefined): URL | null {
	if (!avatarUrl) return null;
	try {
		if (avatarUrl.startsWith('/')) {
			if (!seerrBase) return null;
			const base = new URL(seerrBase);
			const resolved = new URL(avatarUrl, base);
			return resolved.origin === base.origin ? resolved : null;
		}
		const url = new URL(avatarUrl);
		if (url.username || url.password) return null;
		return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
	} catch {
		return null;
	}
}

type Cached = { bytes: ArrayBuffer; type: string; at: number };

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;
const cache = new Map<string, Cached>();

/** Fetches (and briefly caches in memory) an avatar image. Null if it isn't a usable image. */
export async function fetchAvatar(
	source: URL,
	fetchFn: typeof fetch = fetch,
	now = Date.now()
): Promise<Cached | null> {
	const key = source.href;
	const hit = cache.get(key);
	if (hit && now - hit.at < TTL_MS) return hit;

	try {
		const res = await fetchFn(source, { signal: AbortSignal.timeout(5000) });
		const type = res.headers.get('content-type') ?? '';
		// Serve raster images only: an upstream SVG must not execute on Votarr's origin.
		if (!res.ok || !/^image\/(png|jpeg|gif|webp|avif)(;|$)/i.test(type)) return null;
		const bytes = await res.arrayBuffer();
		if (bytes.byteLength > MAX_BYTES) return null;
		const entry = { bytes, type, at: now };
		if (cache.size >= 128) cache.delete(cache.keys().next().value!);
		cache.set(key, entry);
		return entry;
	} catch {
		return null;
	}
}
