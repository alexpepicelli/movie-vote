import { redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { SESSION_COOKIE, invalidateSession } from '#lib/server/auth/sessions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: ({ cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) invalidateSession(db, token);
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/login');
	}
};
