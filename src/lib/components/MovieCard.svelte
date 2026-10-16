<script lang="ts">
	import { resolve } from '$app/paths';
	import type { StatusInput } from '#lib/status.js';
	import Poster from './Poster.svelte';
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
</script>

<div class="group relative">
	<a
		href={resolve('/movie/[tmdbId]', { tmdbId: String(movie.tmdbId) })}
		class="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
	>
		<Poster
			path={movie.posterPath}
			title={movie.title}
			class="transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_14px_30px_rgba(0,0,0,0.5)] group-focus-visible:ring-2 group-focus-visible:ring-accent"
		>
			<div class="absolute bottom-2 left-2">
				<StatusBadge {status} compact />
			</div>
		</Poster>
		<p class="mt-2 line-clamp-1 text-sm font-semibold">{movie.title}</p>
		<p class="text-xs text-muted">
			{movie.year ?? '—'}{#if movie.rating}&nbsp;· ★ {movie.rating.toFixed(1)}{/if}
		</p>
		{#if wantCount > 1}<p class="mt-1 text-xs font-semibold text-sunset">
				{wantCount} want this
			</p>{/if}
	</a>
	{#if watchlisted !== undefined}
		<div class="absolute top-2 right-2">
			<WatchlistButton tmdbId={movie.tmdbId} added={watchlisted} variant="icon" />
		</div>
	{/if}
</div>
