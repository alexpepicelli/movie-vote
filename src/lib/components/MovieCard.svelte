<script lang="ts">
	import { resolve } from '$app/paths';
	import { imageUrl, type StatusInput } from '#lib/status.js';
	import StatusBadge from './StatusBadge.svelte';
	import WatchlistButton from './WatchlistButton.svelte';

	type Movie = {
		tmdbId: number;
		title: string;
		year: number | null;
		posterPath: string | null;
		rating: number | null;
	};

	let {
		movie,
		status,
		watchlisted,
		wantCount = 0
	}: {
		movie: Movie;
		status: StatusInput;
		/** Pass to show the quick add/remove button. */
		watchlisted?: boolean;
		/** Shows a "N want this" tag when more than one person has it on their watchlist. */
		wantCount?: number;
	} = $props();
	const poster = $derived(imageUrl(movie.posterPath, 'w342'));
	let failed = $state(false);
</script>

<div class="relative">
	<a
		href={resolve('/movie/[tmdbId]', { tmdbId: String(movie.tmdbId) })}
		class="group block focus-visible:outline-none"
	>
		<div
			class="relative aspect-[2/3] overflow-hidden rounded-xl bg-panel ring-1 ring-line transition group-hover:ring-marquee group-focus-visible:ring-2 group-focus-visible:ring-marquee"
		>
			{#if poster && !failed}
				<img
					src={poster}
					alt=""
					loading="lazy"
					onerror={() => (failed = true)}
					class="size-full object-cover transition duration-300 group-hover:scale-105"
				/>
			{:else}
				<div
					class="grid size-full place-items-center p-3 text-center font-display text-xl text-muted"
				>
					{movie.title}
				</div>
			{/if}
			<div class="absolute top-2 left-2 rounded-full bg-screen/85 shadow-lg backdrop-blur-sm">
				<StatusBadge {status} compact />
			</div>
			{#if wantCount > 1}
				<div
					class="absolute bottom-2 left-2 rounded-full bg-curtain px-2 py-0.5 text-xs font-semibold shadow-lg"
				>
					🔥 {wantCount} want this
				</div>
			{/if}
		</div>
		<p class="mt-2 line-clamp-1 text-sm font-medium">{movie.title}</p>
		<p class="text-xs text-muted">
			{movie.year ?? '—'}{#if movie.rating}&nbsp;· ★ {movie.rating.toFixed(1)}{/if}
		</p>
	</a>
	{#if watchlisted !== undefined}
		<div class="absolute top-2 right-2">
			<WatchlistButton tmdbId={movie.tmdbId} added={watchlisted} variant="icon" />
		</div>
	{/if}
</div>
