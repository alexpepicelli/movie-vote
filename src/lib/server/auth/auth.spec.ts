import { describe, expect, it, vi } from 'vitest';
import { testDb } from '../test-db';
import { hashPassword, verifyPassword } from './password';
import { createSession, invalidateSession, SESSION_TTL_MS, validateSession } from './sessions';
import { createInvite, inviteState, redeemInvite, revokeInvite } from './invites';
import { createLocalUser, upsertSeerrUser, validateSignup, verifyLocalLogin } from './users';
import { seerrLogin } from './seerr-login';
import { RateLimiter } from './rate-limit';
import { safeRedirect } from './cookie';

const DAY = 24 * 60 * 60 * 1000;
const owner = (db: ReturnType<typeof testDb>) =>
	createLocalUser(db, {
		username: 'alex',
		displayName: 'Alex',
		password: 'password1',
		role: 'owner'
	});

describe('passwords', () => {
	it('verifies the right password and rejects the wrong one', async () => {
		const hash = await hashPassword('correct horse');
		expect(hash).toMatch(/^\$argon2id\$v=19\$/);
		expect(await verifyPassword(hash, 'correct horse')).toBe(true);
		expect(await verifyPassword(hash, 'wrong horse')).toBe(false);
	});

	it('rejects malformed hashes', async () => {
		expect(await verifyPassword('nonsense', 'x')).toBe(false);
	});
});

describe('sessions', () => {
	it('round-trips a token to its user', async () => {
		const db = testDb();
		const user = await owner(db);
		const { token } = createSession(db, user.id);
		expect(validateSession(db, token)?.user).toMatchObject({ id: user.id, role: 'owner' });
	});

	it('rejects unknown, expired and invalidated tokens', async () => {
		const db = testDb();
		const user = await owner(db);
		const now = new Date();
		const { token } = createSession(db, user.id, now);

		expect(validateSession(db, 'not-a-token')).toBeNull();
		expect(validateSession(db, token, new Date(now.getTime() + SESSION_TTL_MS + 1))).toBeNull();

		const second = createSession(db, user.id);
		invalidateSession(db, second.token);
		expect(validateSession(db, second.token)).toBeNull();
	});

	it('extends sessions past the halfway point', async () => {
		const db = testDb();
		const user = await owner(db);
		const start = new Date(Math.floor(Date.now() / 1000) * 1000);
		const { token, expiresAt } = createSession(db, user.id, start);

		const early = validateSession(db, token, new Date(start.getTime() + 2 * DAY));
		expect(early?.expiresAt).toEqual(expiresAt);

		const later = new Date(start.getTime() + 20 * DAY);
		const renewed = validateSession(db, token, later);
		expect(renewed?.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);
	});
});

describe('local login', () => {
	it('accepts the right password only', async () => {
		const db = testDb();
		await owner(db);
		expect(await verifyLocalLogin(db, 'alex', 'password1')).not.toBeNull();
		expect(await verifyLocalLogin(db, 'alex', 'nope')).toBeNull();
		expect(await verifyLocalLogin(db, 'nobody', 'password1')).toBeNull();
	});

	it('validates sign-up fields', () => {
		expect(validateSignup('ab', 'A', 'password1')).toMatch(/Username/);
		expect(validateSignup('bob', '', 'password1')).toMatch(/Display name/);
		expect(validateSignup('bob', 'Bob', 'short')).toMatch(/8 characters/);
		expect(validateSignup('bob', 'Bob', 'password1')).toBeNull();
	});
});

describe('invites', () => {
	it('creates a member account once, then reports used', async () => {
		const db = testDb();
		const alex = await owner(db);
		const { code } = createInvite(db, alex.id);
		const signup = { username: 'sam', displayName: 'Sam', password: 'password1' };

		expect(inviteState(db, code)).toBe('valid');
		const first = await redeemInvite(db, code, signup);
		expect(first).toMatchObject({ ok: true, user: { role: 'member', authKind: 'local' } });

		const second = await redeemInvite(db, code, { ...signup, username: 'sam2' });
		expect(second).toEqual({ ok: false, reason: 'used' });
	});

	it('rejects expired, revoked and taken-username invites', async () => {
		const db = testDb();
		const alex = await owner(db);
		const signup = { username: 'sam', displayName: 'Sam', password: 'password1' };

		const old = createInvite(db, alex.id, new Date(Date.now() - 8 * DAY));
		expect(await redeemInvite(db, old.code, signup)).toEqual({ ok: false, reason: 'expired' });

		const revoked = createInvite(db, alex.id);
		revokeInvite(db, revoked.code);
		expect(inviteState(db, revoked.code)).toBe('missing');

		const taken = createInvite(db, alex.id);
		expect(await redeemInvite(db, taken.code, { ...signup, username: 'alex' })).toEqual({
			ok: false,
			reason: 'username_taken'
		});
		expect(inviteState(db, taken.code)).toBe('valid');
	});
});

describe('Seerr users', () => {
	const identity = (id: number, username = `user${id}`) => ({
		seerrUserId: id,
		username,
		displayName: username
	});

	it('makes the first user owner when no owner ID is configured', () => {
		const db = testDb();
		expect(upsertSeerrUser(db, identity(1)).role).toBe('owner');
		expect(upsertSeerrUser(db, identity(2)).role).toBe('member');
		expect(upsertSeerrUser(db, identity(1)).role).toBe('owner');
	});

	it('uses OWNER_SEERR_USER_ID when set', () => {
		const db = testDb();
		expect(upsertSeerrUser(db, identity(1), 7).role).toBe('member');
		expect(upsertSeerrUser(db, identity(7), 7).role).toBe('owner');
	});

	it('reuses the same record and avoids username clashes', async () => {
		const db = testDb();
		await owner(db); // local "alex"
		const a = upsertSeerrUser(db, identity(5, 'alex'));
		const b = upsertSeerrUser(db, identity(5, 'alex'));
		expect(a.id).toBe(b.id);
		expect(a.username).toBe('alex-2');
	});
});

describe('seerrLogin', () => {
	const url = 'http://seerr:5055';

	it('signs in through Jellyfin and logs the Seerr session out', async () => {
		const fetchFn = vi.fn(async (input: string | URL | Request) => {
			if (String(input).endsWith('/auth/jellyfin'))
				return Response.json(
					{ id: 3, jellyfinUsername: 'Sam', displayName: 'Sammy', avatar: '/avatarproxy/sam' },
					{ headers: { 'set-cookie': 'connect.sid=abc; Path=/; HttpOnly' } }
				);
			return new Response(null, { status: 200 });
		});

		const result = await seerrLogin(url, 'Sam', 'pw', fetchFn as typeof fetch);

		expect(result).toEqual({
			ok: true,
			user: { seerrUserId: 3, username: 'sam', displayName: 'Sammy', avatar: '/avatarproxy/sam' }
		});
		await vi.waitFor(() =>
			expect(fetchFn).toHaveBeenCalledWith(
				`${url}/api/v1/auth/logout`,
				expect.objectContaining({ headers: { Cookie: 'connect.sid=abc' } })
			)
		);
	});

	it('falls back to Seerr local login for emails', async () => {
		const fetchFn = vi.fn(async (input: string | URL | Request) =>
			String(input).endsWith('/auth/local')
				? Response.json({ id: 9, email: 'kim@example.com' })
				: new Response(null, { status: 401 })
		);
		const result = await seerrLogin(url, 'kim@example.com', 'pw', fetchFn as typeof fetch);
		expect(result).toMatchObject({ ok: true, user: { seerrUserId: 9, username: 'kim' } });
	});

	it('distinguishes wrong credentials from Seerr being down', async () => {
		const unauthorized = async () => new Response(null, { status: 401 });
		const down = async () => {
			throw new Error('ECONNREFUSED');
		};
		expect(await seerrLogin(url, 'sam', 'x', unauthorized as typeof fetch)).toEqual({
			ok: false,
			reason: 'invalid'
		});
		expect(await seerrLogin(url, 'sam', 'x', down as typeof fetch)).toEqual({
			ok: false,
			reason: 'unavailable'
		});
		expect(await seerrLogin(undefined, 'sam', 'x')).toEqual({
			ok: false,
			reason: 'not_configured'
		});
	});
});

describe('RateLimiter', () => {
	it('blocks after the limit until the window resets', () => {
		const limiter = new RateLimiter(2, 1000);
		expect(limiter.attempt('k', 0)).toBe(true);
		expect(limiter.attempt('k', 10)).toBe(true);
		expect(limiter.attempt('k', 20)).toBe(false);
		expect(limiter.attempt('k', 1001)).toBe(true);
	});
});

describe('safeRedirect', () => {
	it('only allows same-site paths', () => {
		expect(safeRedirect('/admin/invites')).toBe('/admin/invites');
		expect(safeRedirect('//evil.com')).toBe('/');
		expect(safeRedirect('/\\evil.com')).toBe('/');
		expect(safeRedirect('https://evil.com')).toBe('/');
		expect(safeRedirect(null)).toBe('/');
	});
});
