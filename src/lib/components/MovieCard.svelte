<script lang="ts">
	import { resolve } from '$app/paths';
	import { imageUrl, type StatusInput } from '#lib/status.js';
	import StatusBadge from './StatusBadge.svelte';

	type Movie = {
		tmdbId: number;
		title: string;
		year: number | null;
		posterPath: string | null;
		rating: number | null;
	};

	let { movie, status }: { movie: Movie; status: StatusInput } = $props();
	const poster = $derived(imageUrl(movie.posterPath, 'w342'));
	let failed = $state(false);
</script>

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
	</div>
	<p class="mt-2 line-clamp-1 text-sm font-medium">{movie.title}</p>
	<p class="text-xs text-muted">
		{movie.year ?? '—'}{#if movie.rating}&nbsp;· ★ {movie.rating.toFixed(1)}{/if}
	</p>
</a>
