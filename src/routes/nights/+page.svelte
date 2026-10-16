<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import { imageUrl } from '#lib/status.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const isOwner = $derived(data.user?.role === 'owner');
	const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
</script>

<svelte:head><title>Movie nights · Votarr</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3">
	<h1 class="font-display text-4xl text-sunset">Movie nights</h1>
	{#if isOwner && !data.open}
		<a href={resolve('/nights/new')} class="btn w-auto">Start a movie night</a>
	{/if}
</div>

{#if data.open}
	<a
		href={resolve('/nights/[id]', { id: data.open.id })}
		class="card mt-4 flex items-center justify-between gap-3 border-accent/50 p-4 transition hover:border-accent"
	>
		<span>
			<span class="eyebrow block">
				{data.open.status === 'nominating' ? 'Nominations open' : 'Voting open'}
			</span>
			<span class="mt-1 block font-display text-2xl">{data.open.title}</span>
		</span>
		<Icon name="arrow" class="text-accent" />
	</a>
{/if}

{#if data.past.length}
	<ul class="mt-6 grid gap-4 sm:grid-cols-2">
		{#each data.past as night (night.id)}
			{@const poster = imageUrl(night.winner?.posterPath, 'w185')}
			{@const when = night.scheduledFor ?? night.closedAt}
			<li>
				<a
					href={resolve('/nights/[id]', { id: night.id })}
					class="card flex gap-4 p-3 transition hover:-translate-y-0.5 hover:border-accent"
				>
					{#if poster}
						<img src={poster} alt="" class="h-24 w-16 shrink-0 rounded-lg object-cover" />
					{:else}
						<div class="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-raised text-muted">
							<Icon name="film" />
						</div>
					{/if}
					<div class="min-w-0 self-center">
						<p class="truncate font-display text-xl">{night.title}</p>
						{#if when}<p class="text-xs text-muted"><LocalTime date={when} style="date" /></p>{/if}
						<p class="mt-1 truncate text-sm">
							{#if night.winner}
								{night.status === 'watched' ? 'Watched' : 'Winner:'}
								<span class="font-medium">{night.winner.title}</span>
							{:else}
								<span class="text-muted">No winner</span>
							{/if}
						</p>
						<p class="text-xs text-muted">
							{night.nominationCount} nominated
							{#if night.averageRating !== null}
								· <span class="text-sunset">{stars(night.averageRating)}</span>
								{night.averageRating.toFixed(1)} ({night.ratingCount})
							{:else if night.status === 'closed'}
								· results in
							{/if}
						</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{:else if !data.open}
	<div class="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
		<p class="font-display text-2xl">No movie nights yet</p>
		<p class="mt-1 text-sm text-muted">Past nights, winners and ratings will show up here.</p>
	</div>
{/if}
