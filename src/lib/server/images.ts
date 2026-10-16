import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const IMAGE_SIZES = ['w185', 'w342', 'w780', 'w1280'] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

const FILE_RE = /^[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$/;
const TMDB_BASE = 'https://image.tmdb.org/t/p';
const TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp'
};

export function isValidImage(size: string, file: string): size is ImageSize {
	return (IMAGE_SIZES as readonly string[]).includes(size) && FILE_RE.test(file);
}

export const contentType = (file: string) => TYPES[file.split('.').pop()!.toLowerCase()];

/**
 * Returns image bytes from the disk cache, downloading from TMDB on first request.
 * TMDB image paths are content-addressed, so cached files never need refreshing.
 */
export async function getImage(
	cacheDir: string,
	size: ImageSize,
	file: string,
	fetchFn: typeof fetch = fetch
): Promise<Uint8Array | null> {
	const path = join(cacheDir, size, file);
	try {
		return await readFile(path);
	} catch {
		// not cached yet
	}

	const res = await fetchFn(`${TMDB_BASE}/${size}/${file}`, {
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) return null;
	const bytes = new Uint8Array(await res.arrayBuffer());

	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.${process.pid}.tmp`;
	await writeFile(tmp, bytes);
	await rename(tmp, path); // atomic, so concurrent requests never read a half-written file
	return bytes;
}
