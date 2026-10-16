import { describe, expect, it, vi } from 'vitest';
import { checkDatabase, checkService } from './health';
import { openDatabase } from './db/client';

const service = { url: 'http://radarr:7878', apiKey: 'k', statusPath: '/api/v3/system/status' };

describe('checkService', () => {
	it('reports not_configured without url or key', async () => {
		expect(await checkService({ ...service, apiKey: undefined })).toEqual({
			status: 'not_configured'
		});
	});

	it('sends the API key and returns the version', async () => {
		const fetchFn = vi.fn(async () => Response.json({ version: '5.20.0' }));

		const result = await checkService(service, fetchFn as typeof fetch);

		expect(result).toMatchObject({ status: 'ok', version: '5.20.0' });
		expect(fetchFn).toHaveBeenCalledWith(
			'http://radarr:7878/api/v3/system/status',
			expect.objectContaining({ headers: expect.objectContaining({ 'X-Api-Key': 'k' }) })
		);
	});

	it('reports HTTP errors', async () => {
		const fetchFn = async () => new Response('nope', { status: 401 });
		expect(await checkService(service, fetchFn as typeof fetch)).toEqual({
			status: 'error',
			error: 'HTTP 401'
		});
	});

	it('reports network errors', async () => {
		const fetchFn = async () => {
			throw new Error('ECONNREFUSED');
		};
		expect(await checkService(service, fetchFn as typeof fetch)).toEqual({
			status: 'error',
			error: 'ECONNREFUSED'
		});
	});
});

describe('checkDatabase', () => {
	it('is ok for an open database', () => {
		expect(checkDatabase(openDatabase(':memory:')).status).toBe('ok');
	});
});
