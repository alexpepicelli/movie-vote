import { describe, expect, it } from 'vitest';
import { testDb } from './test-db';
import { maskKey, normaliseUrl, saveServiceConfig, serviceConfig } from './settings';

describe('service settings', () => {
	it('falls back to YAMS defaults with no key', () => {
		expect(serviceConfig(testDb(), 'radarr')).toEqual({
			url: 'http://radarr:7878',
			urlSource: 'default',
			apiKey: undefined,
			keySource: 'none'
		});
	});

	it('uses env vars when nothing is saved, and saved values over env', () => {
		const db = testDb();
		const env = { seerr: { url: 'http://env-seerr:5055', apiKey: 'envkey' } };
		expect(serviceConfig(db, 'seerr', env)).toMatchObject({
			url: 'http://env-seerr:5055',
			urlSource: 'env',
			apiKey: 'envkey',
			keySource: 'env'
		});

		saveServiceConfig(db, 'seerr', { url: 'http://seerr:5055', apiKey: 'savedkey' });
		expect(serviceConfig(db, 'seerr', env)).toMatchObject({
			url: 'http://seerr:5055',
			urlSource: 'saved',
			apiKey: 'savedkey',
			keySource: 'saved'
		});
	});

	it('keeps the saved key when the field is left blank, and can clear it', () => {
		const db = testDb();
		saveServiceConfig(db, 'radarr', { url: 'http://radarr:7878', apiKey: 'abc123' });
		saveServiceConfig(db, 'radarr', { url: 'http://radarr:9999', apiKey: '' });
		expect(serviceConfig(db, 'radarr')).toMatchObject({
			url: 'http://radarr:9999',
			apiKey: 'abc123'
		});

		saveServiceConfig(db, 'radarr', { url: 'http://radarr:9999', clearKey: true });
		expect(serviceConfig(db, 'radarr').keySource).toBe('none');
	});

	it('keeps services separate', () => {
		const db = testDb();
		saveServiceConfig(db, 'seerr', { url: 'http://seerr:5055', apiKey: 's' });
		expect(serviceConfig(db, 'radarr').apiKey).toBeUndefined();
	});
});

describe('normaliseUrl', () => {
	it('accepts http(s) URLs and strips trailing slashes', () => {
		expect(normaliseUrl(' http://radarr:7878/ ')).toEqual({ ok: true, url: 'http://radarr:7878' });
		expect(normaliseUrl('https://x.example.com/radarr/')).toEqual({
			ok: true,
			url: 'https://x.example.com/radarr'
		});
	});

	it('rejects other schemes and junk', () => {
		expect(normaliseUrl('ftp://radarr')).toMatchObject({ ok: false });
		expect(normaliseUrl('radarr:7878')).toMatchObject({ ok: false });
		expect(normaliseUrl('')).toMatchObject({ ok: false });
	});
});

it('masks keys to the last four characters', () => {
	expect(maskKey('0123456789abcdef')).toBe('…cdef');
	expect(maskKey(undefined)).toBeNull();
});
