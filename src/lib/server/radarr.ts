/** Minimal Radarr v3 client: is a movie on disk, wanted, or downloading? */

export type RadarrState =
	| { status: 'available' }
	| { status: 'downloading'; progress: number }
	| { status: 'monitored' } // in Radarr and wanted, but no file yet
	| { status: 'missing' }; // not in Radarr at all (or unmonitored without a file)

type RadarrMovie = { id: number; tmdbId: number; hasFile: boolean; monitored: boolean };
type QueueRecord = { movieId?: number; size?: number; sizeleft?: number };

const TIMEOUT_MS = 8000;
const CONCURRENCY = 5;

export class RadarrClient {
	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string,
		private readonly fetchFn: typeof fetch = fetch
	) {}

	/** Looks up several movies. Fetches the download queue once for all of them. */
	async states(tmdbIds: number[]): Promise<Map<number, RadarrState>> {
		const queue = await this.queueProgress();
		const movies: RadarrMovie[][] = [];
		for (let i = 0; i < tmdbIds.length; i += CONCURRENCY) {
			const batch = tmdbIds.slice(i, i + CONCURRENCY);
			movies.push(
				...(await Promise.all(
					batch.map((id) => this.get<RadarrMovie[]>(`/api/v3/movie?tmdbId=${id}`))
				))
			);
		}

		const result = new Map<number, RadarrState>();
		tmdbIds.forEach((tmdbId, i) => {
			const movie = movies[i][0];
			const progress = movie ? queue.get(movie.id) : undefined;
			result.set(
				tmdbId,
				!movie
					? { status: 'missing' }
					: movie.hasFile
						? { status: 'available' }
						: progress !== undefined
							? { status: 'downloading', progress }
							: movie.monitored
								? { status: 'monitored' }
								: { status: 'missing' }
			);
		});
		return result;
	}

	/** Radarr movie id → download progress 0–100. */
	private async queueProgress(): Promise<Map<number, number>> {
		const page = await this.get<{ records: QueueRecord[] }>('/api/v3/queue?pageSize=500');
		const progress = new Map<number, number>();
		for (const r of page.records) {
			if (r.movieId === undefined || !r.size) continue;
			const pct = Math.round(((r.size - (r.sizeleft ?? 0)) / r.size) * 100);
			progress.set(r.movieId, Math.max(progress.get(r.movieId) ?? 0, pct));
		}
		return progress;
	}

	private async get<T>(path: string): Promise<T> {
		const res = await this.fetchFn(`${this.baseUrl}${path}`, {
			headers: { 'X-Api-Key': this.apiKey, Accept: 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) throw new Error(`Radarr returned HTTP ${res.status}`);
		return (await res.json()) as T;
	}
}
