/** Minimal Seerr API client: search, discover and movie details. Requests are made with the API key. */

export type Availability = 'available' | 'partial' | 'processing' | 'pending' | 'none';

export type MovieSummary = {
	tmdbId: number;
	title: string;
	year: number | null;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	rating: number | null; // 0–10
	availability: Availability;
};

export type MovieDetails = MovieSummary & {
	runtime: number | null;
	genres: string[];
	trailerKey: string | null;
};

export type Page<T> = { page: number; totalPages: number; results: T[] };

export class SeerrError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
	}
}

type RawMovie = {
	id: number;
	mediaType?: string;
	title?: string;
	releaseDate?: string;
	overview?: string;
	posterPath?: string | null;
	backdropPath?: string | null;
	voteAverage?: number;
	runtime?: number;
	genres?: { name: string }[];
	relatedVideos?: { site?: string; key?: string; type?: string }[];
	mediaInfo?: { status?: number } | null;
};

type RawPage = { page: number; totalPages: number; results: RawMovie[] };

const TIMEOUT_MS = 8000;

// Seerr MediaStatus: 1 UNKNOWN, 2 PENDING, 3 PROCESSING, 4 PARTIALLY_AVAILABLE, 5 AVAILABLE, 6 DELETED
const AVAILABILITY: Record<number, Availability> = {
	2: 'pending',
	3: 'processing',
	4: 'partial',
	5: 'available'
};

export class SeerrClient {
	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string,
		private readonly fetchFn: typeof fetch = fetch
	) {}

	async search(query: string, page = 1): Promise<Page<MovieSummary>> {
		const raw = await this.get<RawPage>('/api/v1/search', { query, page });
		return toPage(raw);
	}

	async trending(page = 1): Promise<Page<MovieSummary>> {
		const raw = await this.get<RawPage>('/api/v1/discover/trending', {
			page,
			mediaType: 'movie',
			timeWindow: 'week'
		});
		return toPage(raw);
	}

	async popular(page = 1): Promise<Page<MovieSummary>> {
		return toPage(await this.get<RawPage>('/api/v1/discover/movies', { page }));
	}

	async movie(tmdbId: number): Promise<MovieDetails> {
		const raw = await this.get<RawMovie>(`/api/v1/movie/${tmdbId}`);
		const trailer =
			raw.relatedVideos?.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
			raw.relatedVideos?.find((v) => v.site === 'YouTube');
		return {
			...toSummary(raw),
			runtime: raw.runtime || null,
			genres: raw.genres?.map((g) => g.name) ?? [],
			trailerKey: trailer?.key ?? null
		};
	}

	private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
		// Seerr rejects some reserved characters unless they're percent-encoded, so build the query by hand.
		const qs = Object.entries(params)
			.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
			.join('&');
		let res: Response;
		try {
			res = await this.fetchFn(`${this.baseUrl}${path}${qs ? `?${qs}` : ''}`, {
				headers: { 'X-Api-Key': this.apiKey, Accept: 'application/json' },
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
		} catch (e) {
			throw new SeerrError(`Can't reach Seerr: ${e instanceof Error ? e.message : e}`);
		}
		if (!res.ok) throw new SeerrError(`Seerr returned HTTP ${res.status}`, res.status);
		return (await res.json()) as T;
	}
}

function toPage(raw: RawPage): Page<MovieSummary> {
	return {
		page: raw.page,
		totalPages: raw.totalPages,
		results: raw.results
			.filter((r) => r.mediaType === undefined || r.mediaType === 'movie')
			.map(toSummary)
	};
}

function toSummary(raw: RawMovie): MovieSummary {
	const year = raw.releaseDate ? Number(raw.releaseDate.slice(0, 4)) : NaN;
	return {
		tmdbId: raw.id,
		title: raw.title ?? 'Untitled',
		year: Number.isFinite(year) ? year : null,
		overview: raw.overview || null,
		posterPath: raw.posterPath || null,
		backdropPath: raw.backdropPath || null,
		rating: raw.voteAverage ? Math.round(raw.voteAverage * 10) / 10 : null,
		availability: AVAILABILITY[raw.mediaInfo?.status ?? 0] ?? 'none'
	};
}
