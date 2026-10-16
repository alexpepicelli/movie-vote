import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE } from './sessions';

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: expiresAt
	});
}

/** Only allow same-site relative redirects after login (prevents open redirects). */
export function safeRedirect(target: string | null | undefined) {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\'))
		return '/';
	return target;
}
