<script lang="ts">
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import MovieCard from '#lib/components/MovieCard.svelte';
	import MovieRail from '#lib/components/MovieRail.svelte';
	import { cardMovie } from '#lib/status.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const saved = $derived(new Set(data.saved));
	const loading = $derived(navigating.to?.url.pathname === resolve('/discover'));
	const tabs = $derived([
		{ key: 'browse', label: 'Browse' },
		{ key: 'mine', label: `Your watchlist (${data.mineCount})` },
		{ key: 'group', label: 'Most wanted' }
	]);
	const scope = $derived(
		data.tab === 'mine' ? 'your watchlist' : data.tab === 'group' ? 'Most wanted' : 'all movies'
	);
	const link = (tab: string, q = data.q, page = 1) =>
		resolve(
			`/discover?${new URLSearchParams({ tab, ...(q ? { q } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`
		);
	const status = (m: {
		availability: 'available' | 'partial' | 'processing' | 'pending' | 'none';
		radarrStatus: 'available' | 'downloading' | 'monitored' | 'missing' | null;
		radarrProgress: number | null;
	}) => ({
		seerrStatus: m.availability,
		radarrStatus: m.radarrStatus,
		radarrProgress: m.radarrProgress
	});
</script>

<svelte:head><title>{data.q ? `${data.q} · ` : ''}Movies · Votarr</title></svelte:head>

<header class="mb-6 sm:mb-8">
	<h1 class="font-display text-4xl text-sunset sm:text-5xl">Find your next movie</h1>
	<p class="mt-2 text-sm text-muted sm:text-base">
		Find a favourite, save it for later, or see what everyone wants to watch.
	</p>
</header>
<nav aria-label="Movie collections" class="mb-5 flex flex-wrap gap-1 border-b border-line pb-3">
	{#each tabs as tab (tab.key)}
		<a
			href={link(tab.key)}
			aria-current={data.tab === tab.key ? 'page' : undefined}
			class="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold transition sm:px-4 {data.tab ===
			tab.key
				? 'bg-raised text-ink'
				: 'text-muted hover:bg-panel hover:text-ink'}">{tab.label}</a
		>
	{/each}
</nav>
<form
	method="GET"
	action={resolve('/discover')}
	role="search"
	class="mb-8 flex flex-wrap items-end gap-3"
	data-sveltekit-keepfocus
>
	<input type="hidden" name="tab" value={data.tab} />
	<div class="min-w-0 flex-1 basis-52">
		<label for="movie-search" class="mb-2 block text-xs font-semibold text-muted"
			>Search {scope}</label
		>
		<div class="relative">
			<span class="pointer-events-none absolute top-3.5 left-3 text-muted"
				><Icon name="search" size={18} /></span
			>
			<input
				id="movie-search"
				name="q"
				type="search"
				value={data.q}
				maxlength="100"
				placeholder={data.tab === 'browse' ? 'Movie title…' : 'Filter saved titles…'}
				class="field mt-0 pl-10"
			/>
		</div>
	</div>
	{#if data.tab !== 'browse'}
		<label class="text-xs font-semibold text-muted"
			>Sort by
			<select name="sort" value={data.sort} class="field mt-2 text-sm"
				><option value="default">{data.tab === 'group' ? 'Most wanted' : 'Recently saved'}</option
				><option value="title">Title A–Z</option><option value="year">Newest release</option
				></select
			>
		</label>
	{/if}
	<button class="btn w-auto" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
	{#if data.q}<a href={link(data.tab, '')} class="btn-ghost">Clear</a>{/if}
</form>

<div aria-busy={loading} class="min-w-0 space-y-10">
	{#if data.tab === 'mine' || data.tab === 'group'}
		{@const entries = data.tab === 'mine' ? data.mine : data.group}
		<div>
			<h2 class="font-display text-2xl">
				{data.tab === 'mine' ? 'Your watchlist' : 'Most wanted'}
			</h2>
			<p class="mt-1 text-sm text-muted">
				{entries.length}
				{entries.length === 1 ? 'movie' : 'movies'}{data.q
					? ` matching “${data.q}”`
					: data.tab === 'mine'
						? ' saved for a future movie night.'
						: ' from everyone’s watchlists, with watched films left out.'}
			</p>
		</div>
		{#if entries.length}
			<ul
				class="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each entries as entry (entry.movie.tmdbId)}<li>
						<MovieCard
							movie={cardMovie(entry.movie)}
							status={entry.movie}
							watchlisted={saved.has(entry.movie.tmdbId)}
							wantCount={'wantCount' in entry ? entry.wantCount : 0}
						/>
						{#if 'watched' in entry && entry.watched}<p class="mt-1 text-xs text-muted">
								Watched together
							</p>{/if}
						{#if 'wantedBy' in entry}<p
								class="mt-1 line-clamp-2 text-xs text-muted"
								title={entry.wantedBy.map((p) => p.displayName).join(', ')}
							>
								{entry.wantedBy.map((p) => p.displayName).join(', ')}
							</p>{/if}
					</li>{/each}
			</ul>
		{:else}
			<div class="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
				<h3 class="font-display text-2xl">
					{data.q ? 'No matching titles' : 'Room for a few favourites'}
				</h3>
				<p class="mt-2 text-sm text-muted">
					{data.q
						? 'Try a shorter title, or search all movies.'
						: 'Save films with the + button. They’ll be ready when it’s time to nominate.'}
				</p>
				<a href={link('browse')} class="btn mx-auto mt-5 w-fit"
					>{data.q ? 'Search all movies' : 'Browse movies'}</a
				>
			</div>
		{/if}
	{:else}
		{#if data.error}<p
				role="alert"
				class="rounded-xl border border-line bg-panel p-4 text-sm text-muted"
			>
				{data.error}
			</p>{/if}
		{#if data.q}
			{#if data.search}<section aria-label="Search results">
					<h2 class="mb-5 font-display text-2xl">Results for “{data.q}”</h2>
					{#if data.search.results.length}
						<div
							class="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
						>
							{#each data.search.results as movie (movie.tmdbId)}<MovieCard
									{movie}
									status={status(movie)}
									watchlisted={saved.has(movie.tmdbId)}
								/>{/each}
						</div>
						<nav
							aria-label="Search pages"
							class="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm"
						>
							{#if data.search.page > 1}<a
									href={link('browse', data.q, data.search.page - 1)}
									class="btn-ghost">Previous</a
								>{/if}
							<span class="text-muted"
								>Page {data.search.page} of {Math.min(50, data.search.totalPages)}</span
							>
							{#if data.search.page < Math.min(50, data.search.totalPages)}<a
									href={link('browse', data.q, data.search.page + 1)}
									class="btn-ghost">Next</a
								>{/if}
						</nav>
					{:else}<p class="text-muted">
							No movies found. Try another title or check the spelling.
						</p>{/if}
				</section>{/if}
		{:else}
			{#if data.mine.length}<MovieRail
					title="Saved for later"
					description="Your picks, ready for the next movie night."
				>
					{#each data.mine.slice(0, 12) as { movie } (movie.tmdbId)}<MovieCard
							movie={cardMovie(movie)}
							status={movie}
							watchlisted={true}
						/>{/each}
				</MovieRail>{/if}
			{#if data.group.length}<MovieRail
					title="The group’s most wanted"
					description="The films appearing on the most watchlists."
				>
					{#each data.group.slice(0, 12) as { movie, wantCount } (movie.tmdbId)}<MovieCard
							movie={cardMovie(movie)}
							status={movie}
							watchlisted={saved.has(movie.tmdbId)}
							{wantCount}
						/>{/each}
				</MovieRail>{/if}
			{#each data.rows ?? [] as row (row.title)}<MovieRail title={row.title}>
					{#each row.movies as movie (movie.tmdbId)}<MovieCard
							{movie}
							status={status(movie)}
							watchlisted={saved.has(movie.tmdbId)}
						/>{/each}
				</MovieRail>{/each}
		{/if}
		{#if !data.configured}<p class="rounded-xl bg-panel p-5 text-sm text-muted">
				Movie discovery needs Seerr. Your saved collections are available above. {#if data.user?.role === 'owner'}<a
						href={resolve('/admin/settings')}
						class="link">Connect Seerr</a
					>{:else}Ask the owner to connect it.{/if}
			</p>{/if}
	{/if}
</div>
