<script lang="ts">
	import { resolve } from '$app/paths';
	import MovieCard from '#lib/components/MovieCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const saved = $derived(new Set('saved' in data ? data.saved : []));

	const toStatus = (m: {
		availability: 'available' | 'partial' | 'processing' | 'pending' | 'none';
		radarrStatus: 'available' | 'downloading' | 'monitored' | 'missing' | null;
		radarrProgress: number | null;
	}) => ({
		seerrStatus: m.availability,
		radarrStatus: m.radarrStatus,
		radarrProgress: m.radarrProgress
	});
</script>

<svelte:head><title>{data.q ? `${data.q} · ` : ''}Discover · Votarr</title></svelte:head>

<form method="GET" action={resolve('/discover')} class="flex gap-2" data-sveltekit-keepfocus>
	<input
		name="q"
		type="search"
		value={data.q}
		placeholder="Search for a movie…"
		aria-label="Search movies"
		maxlength="100"
		class="field mt-0 flex-1"
	/>
	<button class="btn w-auto px-5">Search</button>
</form>

{#if !data.configured}
	<p class="mt-8 rounded-xl border border-line bg-panel p-6 text-muted">
		Seerr isn't connected yet{#if data.user?.role === 'owner'}: add its API key in
			<a href={resolve('/admin/settings')} class="text-marquee underline">Admin → Settings</a
			>{:else}. Ask the owner to connect it{/if}.
	</p>
{:else if data.error}
	<p class="mt-8 rounded-xl border border-curtain/40 bg-panel p-6 text-curtain" role="alert">
		{data.error}
	</p>
{:else if data.search}
	<h1 class="mt-8 text-sm text-muted">
		Results for <span class="text-ink">“{data.q}”</span>
	</h1>
	{#if data.search.results.length}
		<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each data.search.results as movie (movie.tmdbId)}
				<MovieCard {movie} status={toStatus(movie)} watchlisted={saved.has(movie.tmdbId)} />
			{/each}
		</div>
		{#if data.search.totalPages > 1}
			<nav class="mt-8 flex items-center justify-center gap-4 text-sm">
				{#if data.search.page > 1}
					<a
						href={resolve(`/discover?q=${encodeURIComponent(data.q)}&page=${data.search.page - 1}`)}
						class="text-marquee underline">← Previous</a
					>
				{/if}
				<span class="text-muted">Page {data.search.page} of {data.search.totalPages}</span>
				{#if data.search.page < data.search.totalPages}
					<a
						href={resolve(`/discover?q=${encodeURIComponent(data.q)}&page=${data.search.page + 1}`)}
						class="text-marquee underline">Next →</a
					>
				{/if}
			</nav>
		{/if}
	{:else}
		<p class="mt-4 text-muted">No movies found. Try another title.</p>
	{/if}
{:else if data.rows}
	{#each data.rows as row (row.title)}
		<section class="mt-8">
			<h2 class="font-display text-2xl tracking-wide">{row.title}</h2>
			<div
				class="-mx-4 mt-3 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [&>*]:w-36 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-40"
			>
				{#each row.movies as movie (movie.tmdbId)}
					<MovieCard {movie} status={toStatus(movie)} watchlisted={saved.has(movie.tmdbId)} />
				{/each}
			</div>
		</section>
	{/each}
{/if}
