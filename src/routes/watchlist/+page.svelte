<script lang="ts">
	import { resolve } from '$app/paths';
	import MovieCard from '#lib/components/MovieCard.svelte';
	import { cardMovie } from '#lib/status.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const names = (people: { displayName: string }[]) =>
		people.length <= 3
			? people.map((p) => p.displayName).join(', ')
			: `${people
					.slice(0, 2)
					.map((p) => p.displayName)
					.join(', ')} +${people.length - 2} more`;
</script>

<svelte:head><title>Watchlist · Votarr</title></svelte:head>

<div class="flex items-end justify-between gap-4">
	<h1 class="font-display text-4xl tracking-wide">Watchlist</h1>
	<a href={resolve('/discover')} class="text-sm text-marquee underline">Find more movies</a>
</div>

<div role="tablist" class="mt-4 inline-flex rounded-lg border border-line bg-panel p-1 text-sm">
	<a
		role="tab"
		aria-selected={data.tab === 'mine'}
		href={resolve('/watchlist')}
		data-sveltekit-replacestate
		class="rounded-md px-3 py-1.5 {data.tab === 'mine'
			? 'bg-marquee font-semibold text-screen'
			: 'text-muted'}"
	>
		Mine <span class="opacity-70">{data.mine.length}</span>
	</a>
	<a
		role="tab"
		aria-selected={data.tab === 'group'}
		href={resolve('/watchlist?tab=group')}
		data-sveltekit-replacestate
		class="rounded-md px-3 py-1.5 {data.tab === 'group'
			? 'bg-marquee font-semibold text-screen'
			: 'text-muted'}"
	>
		Most wanted
	</a>
</div>

{#if data.tab === 'mine'}
	{#if data.mine.length}
		<p class="mt-4 text-sm text-muted">
			Everything you'd watch with the group. On movie night, these show first when you nominate.
		</p>
		<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each data.mine as { movie, watched } (movie.tmdbId)}
				<div class:opacity-60={watched}>
					<MovieCard movie={cardMovie(movie)} status={movie} watchlisted={true} />
					{#if watched}<p class="text-xs text-marquee">✓ Watched together</p>{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
			<p class="font-display text-2xl tracking-wide">Nothing here yet</p>
			<p class="mt-1 text-sm text-muted">
				Tap <span class="text-ink">+</span> on any movie to save it for movie night.
			</p>
			<a href={resolve('/discover')} class="btn mt-4 inline-block w-auto px-5">Browse movies</a>
		</div>
	{/if}
{:else if data.group.length}
	<p class="mt-4 text-sm text-muted">
		Everyone's watchlists combined, most wanted first. Films you've already watched together are
		left out.
	</p>
	<ol class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
		{#each data.group as { movie, wantCount, wantedBy, mine }, i (movie.tmdbId)}
			<li>
				<MovieCard movie={cardMovie(movie)} status={movie} watchlisted={mine} {wantCount} />
				<p
					class="mt-0.5 line-clamp-1 text-xs text-muted"
					title={wantedBy.map((p) => p.displayName).join(', ')}
				>
					<span class="text-ink">#{i + 1}</span> · {names(wantedBy)}
				</p>
			</li>
		{/each}
	</ol>
{:else}
	<div class="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
		<p class="font-display text-2xl tracking-wide">No one's added anything yet</p>
		<p class="mt-1 text-sm text-muted">Once friends add movies, the most popular show up here.</p>
	</div>
{/if}
