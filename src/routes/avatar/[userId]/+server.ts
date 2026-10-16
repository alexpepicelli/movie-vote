import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { avatarSource, fetchAvatar } from '#lib/server/avatars.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { seerrUrl } from '#lib/server/integrations.js';
import type { RequestHandler } from './$types';

/** A member's avatar, proxied so browsers never need to reach Seerr. Signed-in users only. */
export const GET: RequestHandler = async ({ params, fetch }) => {
	const user = db
		.select({ avatarUrl: users.avatarUrl })
		.from(users)
		.where(eq(users.id, params.userId))
		.get();
	const source = avatarSource(user?.avatarUrl ?? null, seerrUrl());
	if (!source) error(404);

	const image = await fetchAvatar(source, fetch);
	if (!image) error(404);

	return new Response(image.bytes, {
		headers: {
			'Content-Type': image.type,
			'Cache-Control': 'private, max-age=3600',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
