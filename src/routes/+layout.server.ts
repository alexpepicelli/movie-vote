import type { LayoutServerLoad } from './$types';

const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user, serverTimeZone });
