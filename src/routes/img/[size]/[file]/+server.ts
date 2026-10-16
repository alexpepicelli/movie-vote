import { dirname, join } from 'node:path';
import { error } from '@sveltejs/kit';
import { DATABASE_URL } from '$app/env/private';
import { contentType, getImage, isValidImage } from '#lib/server/images.js';
import type { RequestHandler } from './$types';

const CACHE_DIR = join(dirname(DATABASE_URL), 'images');

export const GET: RequestHandler = async ({ params }) => {
	if (!isValidImage(params.size, params.file)) error(404);

	const bytes = await getImage(CACHE_DIR, params.size, params.file).catch(() => null);
	if (!bytes) error(404);

	return new Response(bytes as BodyInit, {
		headers: {
			'Content-Type': contentType(params.file),
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};
