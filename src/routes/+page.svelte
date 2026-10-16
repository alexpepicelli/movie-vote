<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Countdown from '#lib/components/Countdown.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import Poster from '#lib/components/Poster.svelte';
	import SectionHeader from '#lib/components/SectionHeader.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import WatchlistButton from '#lib/components/WatchlistButton.svelte';
	import WhosIn from '#lib/components/WhosIn.svelte';
	import { imageUrl } from '#lib/status.js';
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

	const eyebrow = $derived(
		n?.status === 'nominating'
			? 'Nominations open'
			: n?.status === 'voting'
				? 'Now voting'
				: 'Results are in'
	);
	const cta = $derived.by(() => {
		if (!n) return '';
		if (n.status === 'nominating')
			return n.nominationsLeft > 0 ? 'Nominate films' : 'See nominations';
		if (n.status === 'voting') return n.votesLeft > 0 ? 'Vote now' : 'See the ballot';
		return showWinner ? 'See results' : 'Reveal the winner';
	});
	const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
</script>

<svelte:head><title>Votarr</title></svelte:head>

{#if data.needsConnecting}
	<a
		href={resolve('/admin/settings')}
		class="mb-6 flex animate-rise items-center justify-between gap-3 rounded-2xl border border-sunset/40 bg-sunset/10 p-4 text-sm"
	>
		<span>
			<span class="font-bold">Connect Seerr and Radarr.</span>
			<span class="text-muted"
				>Paste their API keys to turn on search, requests and status badges.</span
			>
		</span>
		<Icon name="arrow" class="text-sunset" />
	</a>
{/if}

<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
	<div class="flex min-w-0 flex-col gap-10">
		{#if n}
			<section class="card relative animate-rise overflow-hidden p-5 sm:p-7">
				<div
					class="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden"
					aria-hidden="true"
				>
					<div class="retro-sun -top-2 -right-8 size-40 opacity-30 sm:right-8"></div>
					<div class="retro-grid h-24 opacity-70"></div>
				</div>

				<div class="relative flex flex-col gap-5 pt-14 sm:pt-16">
					<div class="flex flex-col gap-2">
						<p class="eyebrow flex items-center gap-2">
							<span
								class="size-2 rounded-full bg-accent {n.status === 'closed' ? '' : 'animate-pulse'}"
							></span>
							{eyebrow}
						</p>
						<h1 class="font-display text-5xl leading-[0.95] text-sunset sm:text-6xl">{n.title}</h1>
						{#if n.scheduledFor}
							<p class="text-sm text-muted"><LocalTime date={n.scheduledFor} /></p>
						{/if}
					</div>

					<Stepper status={n.status} />

					<div class="grid grid-cols-2 gap-3">
						{#if n.status === 'nominating'}
							<StatTile label="Closes in" live={!!n.nominateUntil}>
								{#if n.nominateUntil}<Countdown to={n.nominateUntil} format="clock" />{:else}Owner's
									call{/if}
							</StatTile>
							<StatTile label="Nominated">{n.nominationCount}</StatTile>
						{:else if n.status === 'voting'}
							<StatTile label="Closes in" live={!!n.voteUntil}>
								{#if n.voteUntil}<Countdown to={n.voteUntil} format="clock" />{:else}Owner's call{/if}
							</StatTile>
							<StatTile label="Voted"
								>{n.voterCount}<span class="ml-1 text-base text-muted">/&nbsp;{n.memberCount}</span
								></StatTile
							>
						{:else}
							<StatTile label="Films">{n.nominationCount}</StatTile>
							<StatTile label="Voters">{n.voterCount}</StatTile>
						{/if}
					</div>

					{#if showWinner && n.winner}
						<div class="flex items-center gap-4 rounded-xl border border-line bg-screen/60 p-3">
							<Poster path={n.winner.posterPath} title={n.winner.title} size="w185" class="w-14" />
							<div class="min-w-0">
								<p class="eyebrow">Tonight's feature</p>
								<p class="truncate font-display text-2xl">{n.winner.title}</p>
								<StatusBadge status={n.winner} />
							</div>
						</div>
					{:else if n.status === 'closed' && !n.winner}
						<p class="text-sm text-muted">Nothing was nominated this time.</p>
					{/if}

					<div class="flex flex-col gap-3">
						{#if n.status === 'nominating' && n.nominationsLeft > 0}
							<p class="text-sm">
								You have <strong>{plural(n.nominationsLeft, 'pick')}</strong> left
							</p>
						{:else if n.status === 'voting'}
							<p class="flex items-center justify-between text-sm">
								<span>You have <strong>{n.votesLeft} of {n.maxVotes}</strong> votes left</span>
							</p>
						{/if}
						<a href={resolve('/nights/[id]', { id: n.id })} class="btn">
							{cta}
							<Icon name="arrow" size={18} stroke={2.4} />
						</a>
					</div>
				</div>
			</section>

			{#if isOwner && n.status === 'closed'}
				<a href={resolve('/nights/new')} class="link -mt-6 text-sm">Start the next movie night</a>
			{/if}

			{#if n.ballot.length}
				<section class="animate-rise [animation-delay:80ms]">
					<SectionHeader
						title={n.status === 'nominating' ? 'Nominated so far' : 'On the ballot'}
						href={resolve('/nights/[id]', { id: n.id })}
					/>
					<ul
						class="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5"
					>
						{#each n.ballot as { movie, nominatedBy } (movie.tmdbId)}
							<li>
								<a
									href={resolve('/movie/[tmdbId]', { tmdbId: String(movie.tmdbId) })}
									class="group block"
								>
									<Poster
										path={movie.posterPath}
										title={movie.title}
										size="w185"
										class="transition duration-200 group-hover:-translate-y-1"
									>
										<div class="absolute top-1.5 left-1.5">
											<StatusBadge status={movie} compact />
										</div>
									</Poster>
									<p class="mt-2 truncate text-sm font-semibold">{movie.title}</p>
									<p class="truncate text-xs text-muted">{movie.year ?? '—'} · {nominatedBy}</p>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{:else}
			<section class="card relative animate-rise overflow-hidden p-6 sm:p-8">
				<div
					class="pointer-events-none absolute inset-x-0 top-0 h-36 overflow-hidden"
					aria-hidden="true"
				>
					<div class="retro-sun -top-4 right-6 size-36 opacity-25"></div>
					<div class="retro-grid h-20 opacity-60"></div>
				</div>
				<div class="relative pt-16">
					<h1 class="font-display text-4xl text-sunset sm:text-5xl">
						Hey {data.user?.displayName}
					</h1>
					<p class="mt-2 max-w-md text-muted">
						No movie night planned yet. Meanwhile, keep adding films you'd watch with the group.
					</p>
					<div class="mt-5 flex flex-wrap items-center gap-3">
						{#if isOwner}
							<a href={resolve('/nights/new')} class="btn w-auto">Start a movie night</a>
							<a href={resolve('/discover')} class="btn-ghost">Browse movies</a>
						{:else}
							<a href={resolve('/discover')} class="btn w-auto">Browse movies</a>
						{/if}
					</div>
				</div>
			</section>
		{/if}
	</div>

	<aside class="flex min-w-0 flex-col gap-8 lg:sticky lg:top-6">
		{#if n}
			<div class="animate-rise [animation-delay:120ms]">
				<WhosIn people={n.people} nightId={n.id} canJoin={true} />
			</div>
		{/if}
		{#if data.rateNight}
			<a
				href={resolve('/nights/[id]', { id: data.rateNight.id })}
				class="card flex animate-rise items-center gap-4 p-4 transition hover:border-accent"
			>
				<Poster
					path={data.rateNight.winner.posterPath}
					title={data.rateNight.winner.title}
					size="w185"
					class="w-12"
				/>
				<span class="min-w-0 flex-1">
					<span class="block text-sm text-muted">How was it?</span>
					<span class="block truncate font-bold">{data.rateNight.winner.title}</span>
					<span class="text-sunset" aria-hidden="true">☆☆☆☆☆</span>
				</span>
				<Icon name="forward" class="text-accent" />
			</a>
		{/if}

		{#if data.mostWanted.length}
			<section class="animate-rise [animation-delay:160ms]">
				<SectionHeader title="Most wanted" href={resolve('/watchlist?tab=group')} />
				<ol class="mt-3 flex flex-col">
					{#each data.mostWanted as { movie, wantCount, mine }, i (movie.tmdbId)}
						<li
							class="flex items-center gap-3 rounded-xl py-2 transition hover:bg-panel sm:-mx-2 sm:px-2"
						>
							<span class="w-5 font-mono text-sm font-bold text-accent"
								>{String(i + 1).padStart(2, '0')}</span
							>
							<a
								href={resolve('/movie/[tmdbId]', { tmdbId: String(movie.tmdbId) })}
								class="flex min-w-0 flex-1 items-center gap-3"
							>
								{#if imageUrl(movie.posterPath, 'w185')}
									<img
										src={imageUrl(movie.posterPath, 'w185')}
										alt=""
										loading="lazy"
										class="h-15 w-10 shrink-0 rounded-md object-cover"
									/>
								{:else}
									<span class="h-15 w-10 shrink-0 rounded-md bg-raised"></span>
								{/if}
								<span class="min-w-0">
									<span class="block truncate font-semibold">{movie.title}</span>
									<span class="block truncate text-xs text-muted"
										>{movie.year ?? '—'} · {wantCount} want it</span
									>
								</span>
							</a>
							<WatchlistButton tmdbId={movie.tmdbId} added={mine} variant="icon" />
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<nav class="flex flex-col gap-2 text-sm" aria-label="Shortcuts">
			<a href={resolve('/watchlist')} class="link">Your watchlist ({data.myCount})</a>
			{#if isOwner}
				<a href={resolve('/admin/settings')} class="text-muted hover:text-ink"
					>Seerr & Radarr settings</a
				>
			{/if}
		</nav>
	</aside>
</div>
