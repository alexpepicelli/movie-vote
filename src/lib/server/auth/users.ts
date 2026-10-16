import { count, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import type { SeerrIdentity } from './seerr-login';
import { hashPassword, verifyPassword } from './password';

export type User = typeof users.$inferSelect;

export const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

export function normaliseUsername(raw: string) {
	return raw.trim().toLowerCase();
}

/** Returns an error message, or null if the sign-up fields are valid. */
export function validateSignup(username: string, displayName: string, password: string) {
	if (!USERNAME_RE.test(username))
		return 'Username must be 3–32 characters: letters, numbers, dots, dashes or underscores.';
	if (displayName.length < 1 || displayName.length > 40)
		return 'Display name must be 1–40 characters.';
	if (password.length < 8) return 'Password must be at least 8 characters.';
	if (password.length > 128) return 'Password must be at most 128 characters.';
	return null;
}

export function userCount(db: Db) {
	return db.select({ n: count() }).from(users).get()?.n ?? 0;
}

export function usernameTaken(db: Db, username: string) {
	return !!db.select({ id: users.id }).from(users).where(eq(users.username, username)).get();
}

/**
 * Finds or creates the local record for a Seerr user.
 * Owner rule: if OWNER_SEERR_USER_ID is set, only that Seerr user is owner;
 * otherwise the very first user of the app becomes owner.
 */
export function upsertSeerrUser(db: Db, identity: SeerrIdentity, ownerSeerrUserId?: number): User {
	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(users)
			.where(eq(users.seerrUserId, identity.seerrUserId))
			.get();

		const isOwner =
			ownerSeerrUserId !== undefined
				? identity.seerrUserId === ownerSeerrUserId
				: existing
					? existing.role === 'owner'
					: userCount(tx) === 0;
		const role = isOwner ? 'owner' : 'member';

		const avatarUrl = identity.avatar ?? null;
		if (existing) {
			if (
				existing.role !== role ||
				existing.displayName !== identity.displayName ||
				existing.avatarUrl !== avatarUrl
			) {
				return tx
					.update(users)
					.set({ role, displayName: identity.displayName, avatarUrl })
					.where(eq(users.id, existing.id))
					.returning()
					.get();
			}
			return existing;
		}

		return tx
			.insert(users)
			.values({
				authKind: 'seerr',
				seerrUserId: identity.seerrUserId,
				username: uniqueUsername(tx, identity.username),
				displayName: identity.displayName,
				avatarUrl,
				role
			})
			.returning()
			.get();
	});
}

function uniqueUsername(db: Db, base: string) {
	const clean = base.replace(/[^a-z0-9_.-]/g, '').slice(0, 28) || 'user';
	if (!usernameTaken(db, clean)) return clean;
	for (let i = 2; ; i++) {
		const candidate = `${clean}-${i}`;
		if (!usernameTaken(db, candidate)) return candidate;
	}
}

export async function createLocalUser(
	db: Db,
	input: { username: string; displayName: string; password: string; role: 'owner' | 'member' }
): Promise<User> {
	const passwordHash = await hashPassword(input.password);
	return db
		.insert(users)
		.values({
			authKind: 'local',
			username: input.username,
			displayName: input.displayName,
			passwordHash,
			role: input.role
		})
		.returning()
		.get();
}

// Verified against when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH =
	'$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Returns the local user if the password matches, null otherwise. */
export async function verifyLocalLogin(db: Db, username: string, password: string) {
	const user = db.select().from(users).where(eq(users.username, username)).get();
	const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
	return ok && user?.authKind === 'local' ? user : null;
}

export function findUserByUsername(db: Db, username: string) {
	return db.select().from(users).where(eq(users.username, username)).get();
}
