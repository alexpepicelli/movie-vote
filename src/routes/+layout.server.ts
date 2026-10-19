import { serverTimeZone } from '#lib/server/time-zone.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user, serverTimeZone });
