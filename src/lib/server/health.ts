import { sql } from 'drizzle-orm';
import type { Db } from './db/client';

export type CheckResult =
	| { status: 'ok'; latencyMs: number; version?: string }
	| { status: 'error'; error: string }
	| { status: 'not_configured' };

export type Service = { url?: string; apiKey?: string; statusPath: string };

const TIMEOUT_MS = 5000;

export function checkDatabase(db: Db): CheckResult {
	const started = performance.now();
	try {
		db.get(sql`select 1`);
		return { status: 'ok', latencyMs: Math.round(performance.now() - started) };
	} catch (e) {
		return { status: 'error', error: e instanceof Error ? e.message : String(e) };
	}
}

/** Calls a *arr-style status endpoint authenticated with X-Api-Key. */
export async function checkService(
	{ url, apiKey, statusPath }: Service,
	fetchFn: typeof fetch = fetch
): Promise<CheckResult> {
	if (!url || !apiKey) return { status: 'not_configured' };

	const started = performance.now();
	try {
		const res = await fetchFn(`${url}${statusPath}`, {
			headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` };

		const body = (await res.json().catch(() => ({}))) as { version?: string };
		return {
			status: 'ok',
			latencyMs: Math.round(performance.now() - started),
			version: body.version
		};
	} catch (e) {
		return { status: 'error', error: e instanceof Error ? e.message : String(e) };
	}
}
