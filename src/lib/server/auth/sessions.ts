import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'votarr_session';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY_MS;
const RENEW_WHEN_LEFT_MS = 15 * DAY_MS;

// SQLite stores timestamps in whole seconds; round so returned dates match what's stored.
const expiryFrom = (now: Date) =>
	new Date(Math.floor((now.getTime() + SESSION_TTL_MS) / 1000) * 1000);

export type SessionUser = Pick<
	typeof users.$inferSelect,
	'id' | 'username' | 'displayName' | 'avatarUrl' | 'role' | 'authKind'
>;

/** Only the SHA-256 of the token is stored, so a leaked DB can't be used to hijack sessions. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(db: Db, userId: string, now = new Date()) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = expiryFrom(now);
	db.insert(sessions)
		.values({ id: hashToken(token), userId, expiresAt })
		.run();
	return { token, expiresAt };
}

/**
 * Returns the user for a session token, or null if missing/expired.
 * Sessions are extended (sliding expiry) once they're past the halfway point.
 */
export function validateSession(db: Db, token: string, now = new Date()) {
	const id = hashToken(token);
	const row = db
		.select({
			expiresAt: sessions.expiresAt,
			user: {
				id: users.id,
				username: users.username,
				displayName: users.displayName,
				avatarUrl: users.avatarUrl,
				role: users.role,
				authKind: users.authKind
			}
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.get();

	if (!row) return null;

	if (row.expiresAt.getTime() <= now.getTime()) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}

	let expiresAt = row.expiresAt;
	if (expiresAt.getTime() - now.getTime() < RENEW_WHEN_LEFT_MS) {
		expiresAt = expiryFrom(now);
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
	}

	return { user: row.user as SessionUser, expiresAt };
}

export function invalidateSession(db: Db, token: string) {
	db.delete(sessions)
		.where(eq(sessions.id, hashToken(token)))
		.run();
}

export function deleteExpiredSessions(db: Db, now = new Date()) {
	db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}
