/** Combines Seerr and Radarr state into the one badge friends see. Shared by server and UI. */

export type DisplayStatus =
	| { kind: 'available'; label: 'On server' }
	| { kind: 'downloading'; label: string; progress: number }
	| { kind: 'requested'; label: 'Requested' }
	| { kind: 'none'; label: 'Not requested' };

export type StatusInput = {
	radarrStatus?: 'available' | 'downloading' | 'monitored' | 'missing' | null;
	radarrProgress?: number | null;
	seerrStatus?: 'none' | 'pending' | 'processing' | 'partial' | 'available' | null;
};

export function displayStatus({
	radarrStatus,
	radarrProgress,
	seerrStatus
}: StatusInput): DisplayStatus {
	// Radarr is the source of truth when we have it; Seerr fills in for movies we haven't polled.
	if (radarrStatus === 'available' || (!radarrStatus && seerrStatus === 'available'))
		return { kind: 'available', label: 'On server' };
	if (radarrStatus === 'downloading') {
		const progress = radarrProgress ?? 0;
		return { kind: 'downloading', label: `Downloading ${progress}%`, progress };
	}
	if (
		radarrStatus === 'monitored' ||
		seerrStatus === 'pending' ||
		seerrStatus === 'processing' ||
		seerrStatus === 'partial'
	)
		return { kind: 'requested', label: 'Requested' };
	return { kind: 'none', label: 'Not requested' };
}

/** URL for a TMDB image served through our caching proxy. */
export function imageUrl(
	path: string | null | undefined,
	size: 'w185' | 'w342' | 'w780' | 'w1280'
) {
	return path ? `/img/${size}${path}` : null;
}

/** Shapes a cached movie row for MovieCard (ratings are stored ×10). */
export function cardMovie(row: {
	tmdbId: number;
	title: string;
	year: number | null;
	posterPath: string | null;
	tmdbRating: number | null;
}) {
	return {
		tmdbId: row.tmdbId,
		title: row.title,
		year: row.year,
		posterPath: row.posterPath,
		rating: row.tmdbRating === null ? null : row.tmdbRating / 10
	};
}
