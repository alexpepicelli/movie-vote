import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { checkService, SERVICE_CHECKS, type CheckResult } from '#lib/server/health.js';
import { configFor, invalidateIntegrations } from '#lib/server/integrations.js';
import {
	DEFAULT_URLS,
	maskKey,
	normaliseUrl,
	saveServiceConfig,
	type Service
} from '#lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

const SERVICES = ['seerr', 'radarr'] as const;

export const load: PageServerLoad = async ({ fetch }) => {
	const services = await Promise.all(
		SERVICES.map(async (service) => {
			const c = configFor(service);
			const status = await checkService(
				{ url: c.url, apiKey: c.apiKey, statusPath: SERVICE_CHECKS[service] },
				fetch
			);
			// Never send the key itself to the browser.
			return {
				service,
				url: c.url,
				urlSource: c.urlSource,
				defaultUrl: DEFAULT_URLS[service],
				keyHint: maskKey(c.apiKey),
				keySource: c.keySource,
				status
			};
		})
	);
	return { services };
};

type Fields = { service: Service; url: string; apiKey: string; clearKey: boolean };

async function readFields(request: Request): Promise<Fields | null> {
	const form = await request.formData();
	const service = String(form.get('service'));
	if (service !== 'seerr' && service !== 'radarr') return null;
	return {
		service,
		url: String(form.get('url') ?? ''),
		apiKey: String(form.get('apiKey') ?? '').trim(),
		clearKey: form.get('clearKey') === 'on'
	};
}

function requireOwner(locals: App.Locals) {
	if (locals.user?.role !== 'owner') error(403, 'Only the owner can change settings.');
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requireOwner(locals);
		const f = await readFields(request);
		if (!f) return fail(400, { error: 'Unknown service.' });
		const url = normaliseUrl(f.url);
		if (!url.ok) return fail(400, { service: f.service, error: url.error });

		saveServiceConfig(db, f.service, { url: url.url, apiKey: f.apiKey, clearKey: f.clearKey });
		invalidateIntegrations();
		return { service: f.service, saved: true };
	},

	/** Tries the entered URL and key (or the saved key if the field is blank) without saving. */
	test: async ({ request, locals, fetch }) => {
		requireOwner(locals);
		const f = await readFields(request);
		if (!f) return fail(400, { error: 'Unknown service.' });
		const url = normaliseUrl(f.url);
		if (!url.ok) return fail(400, { service: f.service, error: url.error });

		const apiKey = f.apiKey || configFor(f.service).apiKey;
		const result: CheckResult = await checkService(
			{ url: url.url, apiKey, statusPath: SERVICE_CHECKS[f.service] },
			fetch
		);
		return { service: f.service, tested: result };
	}
};
