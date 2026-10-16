import { fail, redirect } from '@sveltejs/kit';
import { OWNER_SEERR_USER_ID, SEERR_URL } from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import { createSession } from '#lib/server/auth/sessions.js';
import { safeRedirect, setSessionCookie } from '#lib/server/auth/cookie.js';
import { loginLimiter } from '#lib/server/auth/rate-limit.js';
import { seerrLogin } from '#lib/server/auth/seerr-login.js';
import {
	createLocalUser,
	findUserByUsername,
	normaliseUsername,
	upsertSeerrUser,
	userCount,
	validateSignup,
	verifyLocalLogin
} from '#lib/server/auth/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	return { needsSetup: userCount(db) === 0, seerrEnabled: !!SEERR_URL };
};

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress, fetch }) => {
		const form = await request.formData();
		const typed = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!typed || !password)
			return fail(400, { username: typed, error: 'Enter your username and password.' });

		// Behind Cloudflare Tunnel every request comes from cloudflared, so prefer the real client IP
		// Cloudflare passes along. Only used to key the rate limiter.
		const ip = request.headers.get('cf-connecting-ip') ?? getClientAddress();
		const limitKey = `${ip}:${typed.toLowerCase()}`;
		if (!loginLimiter.attempt(limitKey))
			return fail(429, { username: typed, error: 'Too many attempts. Try again in 15 minutes.' });

		// Local (invite) accounts are checked here; everyone else goes to Seerr.
		const username = normaliseUsername(typed);
		const existing = findUserByUsername(db, username);
		let userId: string | undefined;

		if (existing?.authKind === 'local') {
			userId = (await verifyLocalLogin(db, username, password))?.id;
		} else {
			const result = await seerrLogin(SEERR_URL, typed, password, fetch);
			if (result.ok) userId = upsertSeerrUser(db, result.user, OWNER_SEERR_USER_ID).id;
			else if (result.reason === 'unavailable')
				return fail(503, {
					username: typed,
					error: "Can't reach Seerr right now. Try again shortly."
				});
		}

		if (!userId) return fail(400, { username: typed, error: 'Wrong username or password.' });

		loginLimiter.reset(limitKey);
		const { token, expiresAt } = createSession(db, userId);
		setSessionCookie(cookies, token, expiresAt);
		redirect(303, safeRedirect(String(form.get('redirectTo') ?? '')));
	},

	/** First-run only: creates the owner as a local account when the app has no users. */
	setup: async ({ request, cookies }) => {
		if (userCount(db) > 0) return fail(403, { setupError: 'Setup is already complete.' });

		const form = await request.formData();
		const username = normaliseUsername(String(form.get('username') ?? ''));
		const displayName = String(form.get('displayName') ?? '').trim();
		const password = String(form.get('password') ?? '');

		const error = validateSignup(username, displayName, password);
		if (error) return fail(400, { setupError: error, username, displayName });

		const user = await createLocalUser(db, { username, displayName, password, role: 'owner' });
		const { token, expiresAt } = createSession(db, user.id);
		setSessionCookie(cookies, token, expiresAt);
		redirect(303, '/');
	}
};
