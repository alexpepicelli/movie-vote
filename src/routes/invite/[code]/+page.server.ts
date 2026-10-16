import { fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { inviteState, redeemInvite } from '#lib/server/auth/invites.js';
import { createSession } from '#lib/server/auth/sessions.js';
import { setSessionCookie } from '#lib/server/auth/cookie.js';
import { normaliseUsername, validateSignup } from '#lib/server/auth/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	if (locals.user) redirect(303, '/');
	return { state: inviteState(db, params.code) };
};

const REASONS = {
	used: 'This invite has already been used.',
	expired: 'This invite has expired. Ask for a new one.',
	missing: "This invite link isn't valid.",
	username_taken: 'That username is taken. Pick another.'
} as const;

export const actions: Actions = {
	default: async ({ request, params, cookies }) => {
		const form = await request.formData();
		const username = normaliseUsername(String(form.get('username') ?? ''));
		const displayName = String(form.get('displayName') ?? '').trim();
		const password = String(form.get('password') ?? '');

		const error = validateSignup(username, displayName, password);
		if (error) return fail(400, { error, username, displayName });

		const result = await redeemInvite(db, params.code, { username, displayName, password });
		if (!result.ok) return fail(400, { error: REASONS[result.reason], username, displayName });

		const { token, expiresAt } = createSession(db, result.user.id);
		setSessionCookie(cookies, token, expiresAt);
		redirect(303, '/');
	}
};
