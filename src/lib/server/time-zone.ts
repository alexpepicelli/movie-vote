/**
 * The zone the server renders dates in. An unrecognised TZ (Node then reports "Etc/Unknown")
 * makes every toLocaleString with that zone throw, so fall back to UTC instead.
 */
export function usableTimeZone(zone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
	try {
		new Intl.DateTimeFormat('en', { timeZone: zone });
		return zone;
	} catch {
		return 'UTC';
	}
}

export const serverTimeZone = usableTimeZone();
