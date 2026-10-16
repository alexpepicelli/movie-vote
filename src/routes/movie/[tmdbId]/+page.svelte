<script lang="ts">
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import WatchlistButton from '#lib/components/WatchlistButton.svelte';
	import { enhance } from '$app/forms';
	import { displayStatus, imageUrl } from '#lib/status.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let requesting = $state(false);
	const m = $derived(data.movie);
	const backdrop = $derived(imageUrl(m.backdropPath, 'w1280'));
	const poster = $derived(imageUrl(m.posterPath, 'w342'));
	const runtime = $derived(
		m.runtime ? `${Math.floor(m.runtime / 60)}h ${String(m.runtime % 60).padStart(2, '0')}m` : null
	);
</script>

<svelte:head><title>{m.title} · Movie Vote</title></svelte:head>

<article>
	<div class="relative -mx-4 -mt-6 overflow-hidden sm:mx-0 sm:rounded-2xl">
		{#if backdrop}
			<img src={backdrop} alt="" class="aspect-[21/9] w-full object-cover opacity-60" />
		{:else}
			<div class="aspect-[21/9] w-full bg-panel"></div>
		{/if}
		<div class="absolute inset-0 bg-gradient-to-t from-screen via-screen/40 to-transparent"></div>
	</div>

	<div class="relative -mt-20 flex flex-col gap-6 sm:-mt-28 sm:flex-row sm:px-6">
		<div class="w-32 shrink-0 sm:w-48">
			{#if poster}
				<img
					src={poster}
					alt="{m.title} poster"
					class="w-full rounded-xl shadow-2xl ring-1 ring-line"
				/>
			{/if}
		</div>

		<div class="min-w-0 flex-1 sm:pt-24">
			<h1 class="font-display text-4xl leading-none tracking-wide sm:text-5xl">{m.title}</h1>
			<p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
				{#if m.year}<span>{m.year}</span>{/if}
				{#if runtime}<span>{runtime}</span>{/if}
				{#if m.tmdbRating}<span>★ {(m.tmdbRating / 10).toFixed(1)}</span>{/if}
				<StatusBadge status={m} />
			</p>

			{#if m.genres?.length}
				<ul class="mt-3 flex flex-wrap gap-2">
					{#each m.genres as genre (genre)}
						<li class="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
							{genre}
						</li>
					{/each}
				</ul>
			{/if}

			{#if m.overview}<p class="mt-4 max-w-prose leading-relaxed">{m.overview}</p>{/if}

			<div class="mt-6 flex flex-wrap items-start gap-3">
				<WatchlistButton tmdbId={m.tmdbId} added={data.onMyWatchlist} />
				{#if data.user?.role === 'owner' && data.canRequest && displayStatus(m).kind === 'none'}
					<form
						method="POST"
						action="?/request"
						use:enhance={() => {
							requesting = true;
							return async ({ update }) => {
								await update({ reset: false, navigate: false });
								requesting = false;
							};
						}}
					>
						<button
							disabled={requesting}
							class="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:border-marquee"
						>
							{requesting ? 'Requesting…' : '⬇ Request via Seerr'}
						</button>
					</form>
				{/if}
				{#if m.trailerKey}
					<a
						href="https://www.youtube.com/watch?v={encodeURIComponent(m.trailerKey)}"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:border-marquee"
					>
						▶ Watch trailer
					</a>
				{/if}
			</div>

			{#if form?.error}
				<p class="mt-3 text-sm text-curtain" role="alert">{form.error}</p>
			{:else if form?.requested}
				<p class="mt-3 text-sm text-emerald-300" role="status">
					{form.already
						? 'Already requested in Seerr.'
						: 'Requested! Radarr will pick it up shortly.'}
				</p>
			{/if}

			{#if data.wanters.length}
				<p class="mt-4 text-sm text-muted">
					<span class="text-ink"
						>{data.wanters.length === 1
							? '1 person wants'
							: `${data.wanters.length} people want`}</span
					>
					to watch this: {data.wanters.map((p) => p.displayName).join(', ')}
				</p>
			{/if}
		</div>
	</div>
</article>
