import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { db } from '#lib/server/db/index.js';
import { runMigrations } from '#lib/server/db/client.js';
import {
	SESSION_COOKIE,
	deleteExpiredSessions,
	validateSession
} from '#lib/server/auth/sessions.js';
import { setSessionCookie } from '#lib/server/auth/cookie.js';

export const init: ServerInit = () => {
	runMigrations(db);
	deleteExpiredSessions(db);
};

const PUBLIC_PATHS = ['/login', '/healthz'];
const PUBLIC_PREFIXES = ['/invite/'];

const isPublic = (path: string) =>
	PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const session = token ? validateSession(db, token) : null;

	if (token && !session) {
		event.cookies.delete(SESSION_COOKIE, { path: '/' });
	} else if (token && session) {
		// Re-set so a renewed (slid) expiry reaches the browser.
		setSessionCookie(event.cookies, token, session.expiresAt);
	}

	event.locals.user = session?.user ?? null;

	const path = event.url.pathname;
	if (!event.locals.user && !isPublic(path)) {
		const redirectTo =
			path === '/' ? '' : `?redirectTo=${encodeURIComponent(path + event.url.search)}`;
		redirect(303, `/login${redirectTo}`);
	}

	return resolve(event);
};
