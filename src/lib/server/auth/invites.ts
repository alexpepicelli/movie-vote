import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { invites, users } from '../db/schema';
import { hashPassword } from './password';
import { usernameTaken, type User } from './users';

export const INVITE_TTL_DAYS = 7;

export function createInvite(db: Db, createdBy: string, now = new Date()) {
	const code = randomBytes(12).toString('base64url');
	const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
	return db.insert(invites).values({ code, createdBy, expiresAt }).returning().get();
}

export function listInvites(db: Db) {
	return db
		.select({
			code: invites.code,
			expiresAt: invites.expiresAt,
			usedAt: invites.usedAt,
			usedBy: users.displayName
		})
		.from(invites)
		.leftJoin(users, eq(users.id, invites.usedBy))
		.orderBy(desc(invites.expiresAt))
		.all();
}

/** Deletes an invite that hasn't been used yet. */
export function revokeInvite(db: Db, code: string) {
	db.delete(invites)
		.where(and(eq(invites.code, code), isNull(invites.usedBy)))
		.run();
}

export type InviteState = 'valid' | 'used' | 'expired' | 'missing';

export function inviteState(db: Db, code: string, now = new Date()): InviteState {
	const invite = db.select().from(invites).where(eq(invites.code, code)).get();
	if (!invite) return 'missing';
	if (invite.usedBy || invite.usedAt) return 'used';
	if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
	return 'valid';
}

export type RedeemResult =
	| { ok: true; user: User }
	| { ok: false; reason: Exclude<InviteState, 'valid'> | 'username_taken' };

/** Creates a member account from an invite, marking the invite used in the same transaction. */
export async function redeemInvite(
	db: Db,
	code: string,
	input: { username: string; displayName: string; password: string },
	now = new Date()
): Promise<RedeemResult> {
	// Hash outside the transaction: better-sqlite3 transactions must be synchronous.
	const passwordHash = await hashPassword(input.password);

	return db.transaction((tx) => {
		const state = inviteState(tx, code, now);
		if (state !== 'valid') return { ok: false, reason: state };
		if (usernameTaken(tx, input.username)) return { ok: false, reason: 'username_taken' };

		const user = tx
			.insert(users)
			.values({
				authKind: 'local',
				username: input.username,
				displayName: input.displayName,
				passwordHash,
				role: 'member'
			})
			.returning()
			.get();
		tx.update(invites).set({ usedBy: user.id, usedAt: now }).where(eq(invites.code, code)).run();
		return { ok: true, user };
	});
}
