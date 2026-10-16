import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { createInvite, listInvites, revokeInvite } from '#lib/server/auth/invites.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ invites: listInvites(db) });

// Layout loads don't guard form actions, so each action checks the role itself.
export const actions: Actions = {
	create: ({ locals }) => {
		if (locals.user?.role !== 'owner') error(403);
		const invite = createInvite(db, locals.user.id);
		return { created: invite.code };
	},
	revoke: async ({ locals, request }) => {
		if (locals.user?.role !== 'owner') error(403);
		const code = String((await request.formData()).get('code') ?? '');
		revokeInvite(db, code);
	}
};
