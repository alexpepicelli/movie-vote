import { db } from '#lib/server/db/index.js';
import { advanceDueNights, openNight, pastNights } from '#lib/server/nights.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	advanceDueNights(db);
	const open = openNight(db);
	return {
		open: open ? { id: open.id, title: open.title, status: open.status } : null,
		past: pastNights(db)
	};
};
