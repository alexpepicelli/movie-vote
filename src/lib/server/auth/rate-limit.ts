/** Fixed-window, in-memory limiter. Good enough for a single-container app. */
export class RateLimiter {
	#hits = new Map<string, { count: number; resetAt: number }>();

	constructor(
		private readonly limit: number,
		private readonly windowMs: number
	) {}

	/** Records an attempt; returns false if the key is over the limit. */
	attempt(key: string, now = Date.now()): boolean {
		const entry = this.#hits.get(key);
		if (!entry || entry.resetAt <= now) {
			this.#hits.set(key, { count: 1, resetAt: now + this.windowMs });
			this.#sweep(now);
			return true;
		}
		entry.count++;
		return entry.count <= this.limit;
	}

	reset(key: string) {
		this.#hits.delete(key);
	}

	#sweep(now: number) {
		if (this.#hits.size < 1000) return;
		for (const [key, entry] of this.#hits) if (entry.resetAt <= now) this.#hits.delete(key);
	}
}

export const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);
