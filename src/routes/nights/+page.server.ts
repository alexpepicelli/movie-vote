import { db } from '#lib/server/db/index.js';
import { nightChanged } from '#lib/server/events.js';
import { advanceDueNights, openNight, pastNights } from '#lib/server/nights.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ depends }) => {
	depends('votarr:nights');
	advanceDueNights(db).forEach((t) => nightChanged(t.nightId));
	const open = openNight(db);
	return {
		open: open ? { id: open.id, title: open.title, status: open.status } : null,
		past: pastNights(db)
	};
};
