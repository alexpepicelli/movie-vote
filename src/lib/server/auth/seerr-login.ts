export type SeerrIdentity = {
	seerrUserId: number;
	username: string;
	displayName: string;
	/** Seerr's avatar for the user: a path on Seerr (e.g. Jellyfin's) or a full URL (Gravatar). */
	avatar?: string;
};

export type SeerrLoginResult =
	| { ok: true; user: SeerrIdentity }
	| { ok: false; reason: 'invalid' | 'unavailable' | 'not_configured' };

type SeerrUser = {
	id: number;
	username?: string | null;
	jellyfinUsername?: string | null;
	plexUsername?: string | null;
	displayName?: string | null;
	email?: string | null;
	avatar?: string | null;
};

const TIMEOUT_MS = 8000;

/**
 * Verifies credentials against Seerr. Tries Jellyfin sign-in first, then Seerr local
 * sign-in (email + password). The Seerr session it creates is logged out straight away;
 * we only use it to confirm who the user is.
 */
export async function seerrLogin(
	baseUrl: string | undefined,
	username: string,
	password: string,
	fetchFn: typeof fetch = fetch
): Promise<SeerrLoginResult> {
	if (!baseUrl) return { ok: false, reason: 'not_configured' };

	const attempts: [path: string, body: object][] = [
		['/api/v1/auth/jellyfin', { username, password }]
	];
	if (username.includes('@')) attempts.push(['/api/v1/auth/local', { email: username, password }]);

	let unavailable = false;
	for (const [path, body] of attempts) {
		let res: Response;
		try {
			res = await fetchFn(`${baseUrl}${path}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
		} catch {
			unavailable = true;
			continue;
		}

		if (res.ok) {
			const user = (await res.json()) as SeerrUser;
			void logout(baseUrl, res.headers.get('set-cookie'), fetchFn);
			return { ok: true, user: toIdentity(user, username) };
		}
		if (res.status >= 500) unavailable = true;
	}

	return { ok: false, reason: unavailable ? 'unavailable' : 'invalid' };
}

function toIdentity(user: SeerrUser, typed: string): SeerrIdentity {
	const username = (
		user.jellyfinUsername ||
		user.username ||
		user.plexUsername ||
		user.email?.split('@')[0] ||
		typed
	).toLowerCase();
	return {
		seerrUserId: user.id,
		username,
		displayName: user.displayName || user.jellyfinUsername || user.username || username,
		avatar: user.avatar || undefined
	};
}

async function logout(baseUrl: string, setCookie: string | null, fetchFn: typeof fetch) {
	const cookie = setCookie?.split(';')[0];
	if (!cookie) return;
	await fetchFn(`${baseUrl}/api/v1/auth/logout`, {
		method: 'POST',
		headers: { Cookie: cookie },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	}).catch(() => {});
}
