import { describe, expect, it, vi } from 'vitest';
import { avatarSource, fetchAvatar } from './avatars';

describe('avatarSource', () => {
	it('resolves Seerr paths against the Seerr address', () => {
		expect(avatarSource('/avatarproxy/abc', 'http://seerr:5055')?.href).toBe(
			'http://seerr:5055/avatarproxy/abc'
		);
	});

	it('keeps full http(s) URLs and rejects anything else', () => {
		expect(avatarSource('https://gravatar.com/avatar/x', undefined)?.href).toBe(
			'https://gravatar.com/avatar/x'
		);
		expect(avatarSource('file:///etc/passwd', 'http://seerr:5055')).toBeNull();
		expect(avatarSource('/a.png', undefined)).toBeNull();
		expect(avatarSource(null, 'http://seerr:5055')).toBeNull();
		expect(avatarSource('//other.test/a.png', 'http://seerr:5055')).toBeNull();
	});
});

describe('fetchAvatar', () => {
	it('returns images and caches them', async () => {
		const fetchFn = vi.fn(
			async () => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } })
		);
		const url = new URL('https://example.test/cached.png');
		expect(await fetchAvatar(url, fetchFn as typeof fetch, 1000)).toMatchObject({
			type: 'image/png'
		});
		await fetchAvatar(url, fetchFn as typeof fetch, 2000);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it('ignores responses that are not images', async () => {
		const fetchFn = async () =>
			new Response('<html>', { headers: { 'Content-Type': 'text/html' } });
		expect(
			await fetchAvatar(new URL('https://example.test/page'), fetchFn as typeof fetch)
		).toBeNull();
	});
	it('does not serve executable SVGs on the app origin', async () => {
		const fetchFn = async () =>
			new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } });
		expect(
			await fetchAvatar(new URL('https://example.test/avatar.svg'), fetchFn as typeof fetch)
		).toBeNull();
	});
});
