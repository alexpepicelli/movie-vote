<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Countdown from '#lib/components/Countdown.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import MovieCard from '#lib/components/MovieCard.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { cardMovie, imageUrl } from '#lib/status.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const n = $derived(data.night);
	const isOwner = $derived(data.user?.role === 'owner');

	// Don't spoil the winner on the home page for anyone who hasn't seen the reveal yet.
	let revealed = $state(false);
	onMount(() => {
		try {
			revealed = !!(n && localStorage.getItem(`votarr-revealed-${n.id}`));
		} catch {
			// storage blocked: keep it hidden
		}
	});
	const showWinner = $derived(!!n?.winner && revealed);
</script>

{#if n}
	<a
		href={resolve('/nights/[id]', { id: n.id })}
		class="group block overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-marquee"
	>
		<div class="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
			<div class="min-w-0 flex-1">
				<p class="text-xs tracking-widest text-marquee uppercase">
					{n.status === 'nominating'
						? 'Nominations open'
						: n.status === 'voting'
							? 'Voting open'
							: 'Results are in'}
				</p>
				<h1 class="mt-1 font-display text-4xl leading-none tracking-wide">{n.title}</h1>
				{#if n.scheduledFor}
					<p class="mt-1 text-sm text-muted">🍿 <LocalTime date={n.scheduledFor} /></p>
				{/if}

				<p class="mt-3 text-sm">
					{#if n.status === 'nominating'}
						{n.nominationCount} nominated so far.
						{#if n.nominationsLeft > 0}<span class="text-marquee"
								>You have {n.nominationsLeft} pick{n.nominationsLeft === 1 ? '' : 's'} left.</span
							>{/if}
						{#if n.nominateUntil}Closes <Countdown to={n.nominateUntil} />.{/if}
					{:else if n.status === 'voting'}
						{n.voterCount} of {n.memberCount} have voted.
						{#if n.votesLeft > 0}<span class="text-marquee"
								>You have {n.votesLeft} vote{n.votesLeft === 1 ? '' : 's'} left.</span
							>{/if}
						{#if n.voteUntil}Closes <Countdown to={n.voteUntil} />.{/if}
					{:else if n.winner && showWinner}
						We're watching <span class="font-semibold">{n.winner.title}</span>
						<StatusBadge status={n.winner} />
					{:else if n.winner}
						The votes are counted. Who won?
					{:else}
						Nothing was nominated.
					{/if}
				</p>

				<span class="btn mt-4 inline-block w-auto px-5">
					{n.status === 'nominating'
						? n.nominationsLeft > 0
							? 'Nominate movies'
							: 'See nominations'
						: n.status === 'voting'
							? n.votesLeft > 0
								? 'Vote now'
								: 'See the ballot'
							: showWinner
								? 'See results'
								: '🎬 Reveal the winner'}
				</span>
			</div>

			{#if showWinner && n.winner && imageUrl(n.winner.posterPath, 'w342')}
				<img
					src={imageUrl(n.winner.posterPath, 'w342')}
					alt=""
					class="w-28 self-center rounded-xl shadow-2xl ring-1 ring-marquee/50 sm:w-36"
				/>
			{:else if n.posters.length}
				<div class="flex -space-x-8 self-center" aria-hidden="true">
					{#each n.posters as poster, i (i)}
						{#if imageUrl(poster, 'w185')}
							<img
								src={imageUrl(poster, 'w185')}
								alt=""
								class="w-16 rounded-lg shadow-xl ring-2 ring-panel transition group-hover:translate-y-[-2px] sm:w-20"
								style="transform: rotate({(i - 2) * 4}deg)"
							/>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</a>
	{#if isOwner && n.status === 'closed'}
		<a href={resolve('/nights/new')} class="mt-3 inline-block text-sm text-marquee underline">
			Start the next movie night
		</a>
	{/if}
{:else}
	<section class="rounded-2xl border border-line bg-panel p-6">
		<h1 class="font-display text-4xl tracking-wide">Hey {data.user?.displayName} 👋</h1>
		<p class="mt-2 text-muted">
			No movie night planned yet. Meanwhile, keep adding films you'd watch with the group.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			{#if isOwner}
				<a href={resolve('/nights/new')} class="btn inline-block w-auto px-5">Start a movie night</a
				>
				<a href={resolve('/discover')} class="text-sm text-marquee underline">Browse movies</a>
			{:else}
				<a href={resolve('/discover')} class="btn inline-block w-auto px-5">Browse movies</a>
			{/if}
		</div>
	</section>
{/if}

<p class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
	<a href={resolve('/watchlist')} class="text-marquee underline">Your watchlist ({data.myCount})</a>
	{#if isOwner}
		<a href={resolve('/healthz?deep')} class="text-muted underline">Check Seerr and Radarr</a>
	{/if}
</p>

{#if data.rateNight}
	<a
		href={resolve('/nights/[id]', { id: data.rateNight.id })}
		class="mt-6 flex items-center gap-4 rounded-xl border border-line bg-panel p-4 transition hover:border-marquee"
	>
		{#if imageUrl(data.rateNight.winner.posterPath, 'w185')}
			<img
				src={imageUrl(data.rateNight.winner.posterPath, 'w185')}
				alt=""
				class="h-16 w-11 shrink-0 rounded object-cover"
			/>
		{/if}
		<span class="min-w-0 flex-1">
			<span class="block text-sm"
				>How was <span class="font-semibold">{data.rateNight.winner.title}</span>?</span
			>
			<span class="block text-xl tracking-wider text-marquee" aria-hidden="true">☆☆☆☆☆</span>
		</span>
		<span class="text-sm text-marquee">Rate it →</span>
	</a>
{/if}

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
