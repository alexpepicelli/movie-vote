import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { nightChanged } from '#lib/server/events.js';
import { createNight, openNight, type NightInput } from '#lib/server/nights.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user?.role !== 'owner') error(403, 'Only the owner can start a movie night.');
	const open = openNight(db);
	return { open: open ? { id: open.id, title: open.title } : null };
};

/** `datetime-local` values have no zone, so they're read in the server's time zone (TZ). */
const dateOrNull = (v: FormDataEntryValue | null) => (v ? new Date(String(v)) : null);

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (locals.user?.role !== 'owner') error(403);
		const form = await request.formData();
		const input: NightInput = {
			title: String(form.get('title') ?? '').trim(),
			scheduledFor: dateOrNull(form.get('scheduledFor')),
			nominateUntil: dateOrNull(form.get('nominateUntil')),
			voteUntil: dateOrNull(form.get('voteUntil')),
			maxNominations: Number(form.get('maxNominations')),
			maxVotes: Number(form.get('maxVotes')),
			selfVoteAllowed: form.get('selfVoteAllowed') === 'on',
			resultsHidden: form.get('resultsHidden') === 'on'
		};

		const result = createNight(db, locals.user.id, input);
		if (!result.ok) return fail(400, { error: result.error, values: Object.fromEntries(form) });
		nightChanged(result.night.id);
		redirect(303, `/nights/${result.night.id}`);
	}
};
