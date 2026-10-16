<script lang="ts">
	import { resolve } from '$app/paths';
	import MovieCard from '#lib/components/MovieCard.svelte';
	import { cardMovie } from '#lib/status.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<section class="rounded-2xl border border-line bg-panel p-6">
	<h1 class="font-display text-4xl tracking-wide">Hey {data.user?.displayName} 👋</h1>
	<p class="mt-2 text-muted">
		No movie night planned yet. Meanwhile, keep adding films you'd watch with the group.
	</p>
	<div class="mt-4 flex flex-wrap items-center gap-3">
		<a href={resolve('/discover')} class="btn inline-block w-auto px-5">Browse movies</a>
		<a href={resolve('/watchlist')} class="text-sm text-marquee underline">
			Your watchlist ({data.myCount})
		</a>
	</div>
	{#if data.user?.role === 'owner'}
		<a href={resolve('/healthz?deep')} class="mt-4 block text-sm text-muted underline">
			Check connections to Seerr and Radarr
		</a>
	{/if}
</section>

{#if data.mostWanted.length}
	<section class="mt-8">
		<div class="flex items-end justify-between">
			<h2 class="font-display text-2xl tracking-wide">Most wanted</h2>
			<a href={resolve('/watchlist?tab=group')} class="text-sm text-marquee underline">See all</a>
		</div>
		<div
			class="-mx-4 mt-3 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [&>*]:w-36 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-40"
		>
			{#each data.mostWanted as { movie, wantCount, mine } (movie.tmdbId)}
				<MovieCard movie={cardMovie(movie)} status={movie} watchlisted={mine} {wantCount} />
			{/each}
		</div>
	</section>
{/if}
