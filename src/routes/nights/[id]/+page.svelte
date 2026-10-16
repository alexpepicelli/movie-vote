<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Countdown from '#lib/components/Countdown.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import MovieCard from '#lib/components/MovieCard.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { cardMovie, imageUrl, type StatusInput } from '#lib/status.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type PickItem = {
		movie: Parameters<typeof cardMovie>[0];
		status: StatusInput;
		wantCount?: number;
	};
	const night = $derived(data.night);
	const isOwner = $derived(data.user?.role === 'owner');

	const PHASES = [
		{ key: 'nominating', label: 'Nominate' },
		{ key: 'voting', label: 'Vote' },
		{ key: 'closed', label: 'Results' }
	] as const;
	const phaseIndex = $derived(
		Math.max(
			0,
			PHASES.findIndex((p) => p.key === night.status)
		)
	);

	const nominationsLeft = $derived(night.maxNominations - data.myNominationCount);
	const votesLeft = $derived(night.maxVotes - data.myVoteCount);

	// Stay on this page (and keep any search) after every action; show errors inline.
	let busy = $state<string | null>(null);
	const keep =
		(key: string): SubmitFunction =>
		() => {
			busy = key;
			return async ({ update }) => {
				await update({ reset: false, navigate: false });
				busy = null;
			};
		};

	const confirmFirst =
		(message: string, key: string): SubmitFunction =>
		(input) => {
			if (!confirm(message)) return input.cancel();
			return keep(key)(input);
		};

	// Pick up friends' nominations and votes without a manual reload.
	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible' && ['nominating', 'voting'].includes(night.status))
				void refreshAll();
		}, 30_000);
		return () => clearInterval(timer);
	});

	const titleOf = (tmdbId: number) =>
		data.entries.find((e) => e.movie.tmdbId === tmdbId)?.movie.title ?? 'another film';
	const winner = $derived(night.status === 'closed' ? data.entries[0] : undefined);
	const tieBreak = $derived(night.results?.tieBreak);
	const tieText = $derived.by(() => {
		if (!winner || !tieBreak || tieBreak.by === 'none') return null;
		const others = new Intl.ListFormat('en', { type: 'conjunction' }).format(
			tieBreak.tiedWith.map(titleOf)
		);
		return tieBreak.by === 'saves'
			? `Tied on votes with ${others}. Won by being on more watchlists.`
			: `Tied on votes and watchlists with ${others}. Won the random draw (seed ${tieBreak.seed}).`;
	});
	const maxVotes = $derived(Math.max(1, ...data.entries.map((e) => e.votes ?? 0)));
</script>

<svelte:head><title>{night.title} · Movie Vote</title></svelte:head>

<header>
	<p class="text-xs tracking-widest text-muted uppercase">Movie night</p>
	<h1 class="font-display text-4xl leading-none tracking-wide sm:text-5xl">{night.title}</h1>
	{#if night.scheduledFor}
		<p class="mt-1 text-sm text-muted">🍿 <LocalTime date={night.scheduledFor} /></p>
	{/if}

	<ol class="mt-4 flex items-center gap-2 text-sm" aria-label="Progress">
		{#each PHASES as phase, i (phase.key)}
			<li class="flex items-center gap-2">
				<span
					aria-current={i === phaseIndex ? 'step' : undefined}
					class="rounded-full px-3 py-1 {i === phaseIndex
						? 'bg-marquee font-semibold text-screen'
						: i < phaseIndex
							? 'bg-panel text-ink'
							: 'bg-panel text-muted'}"
				>
					{i < phaseIndex ? '✓ ' : ''}{phase.label}
				</span>
				{#if i < PHASES.length - 1}<span class="text-line" aria-hidden="true">—</span>{/if}
			</li>
		{/each}
	</ol>

	{#if night.status === 'nominating' && night.nominateUntil}
		<p class="mt-3 text-sm">
			Nominations close <Countdown to={night.nominateUntil} />
			<span class="text-muted">(<LocalTime date={night.nominateUntil} />)</span>
		</p>
	{/if}
	{#if (night.status === 'nominating' || night.status === 'voting') && night.voteUntil}
		<p class="mt-1 text-sm">
			Voting closes <Countdown to={night.voteUntil} />
			<span class="text-muted">(<LocalTime date={night.voteUntil} />)</span>
		</p>
	{/if}

	{#if isOwner}
		<div class="mt-4 flex flex-wrap gap-3 rounded-xl border border-dashed border-line p-3 text-sm">
			<span class="self-center text-muted">Owner:</span>
			{#if night.status === 'nominating'}
				<form
					method="POST"
					action="?/startVoting"
					use:enhance={data.entries.length
						? keep('startVoting')
						: confirmFirst(
								'Nobody has nominated anything yet. Start voting anyway?',
								'startVoting'
							)}
				>
					<button disabled={busy !== null} class="btn w-auto px-4 py-1.5">Start voting now</button>
				</form>
			{:else if night.status === 'voting'}
				<form
					method="POST"
					action="?/close"
					use:enhance={confirmFirst(
						`Close voting? ${data.voterCount} of ${data.memberCount} people have voted.`,
						'close'
					)}
				>
					<button disabled={busy !== null} class="btn w-auto px-4 py-1.5"
						>Close voting & reveal</button
					>
				</form>
			{/if}
			<form
				method="POST"
				action="?/cancel"
				use:enhance={confirmFirst(
					'Cancel this movie night? Its nominations and votes will be deleted.',
					'cancel'
				)}
			>
				<button disabled={busy !== null} class="px-2 py-1.5 text-curtain underline"
					>Cancel night</button
				>
			</form>
		</div>
	{/if}
</header>

{#if form?.error}
	<p class="mt-6 rounded-xl border border-curtain/40 bg-curtain/10 p-3 text-sm" role="alert">
		{form.error}
	</p>
{/if}

<!-- ───────────── Nominating ───────────── -->
{#if night.status === 'nominating'}
	<section class="mt-8">
		<div class="flex flex-wrap items-end justify-between gap-2">
			<h2 class="font-display text-2xl tracking-wide">Nominated so far ({data.entries.length})</h2>
			<p class="text-sm text-muted">
				You've used <span class="text-ink">{data.myNominationCount} of {night.maxNominations}</span>
				nominations
			</p>
		</div>
		{#if data.entries.length}
			<ul class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each data.entries as entry (entry.id)}
					<li>
						<MovieCard
							movie={cardMovie(entry.movie)}
							status={entry.movie}
							wantCount={entry.saves}
						/>
						<div class="mt-1 flex items-center justify-between gap-2 text-xs">
							<span class="truncate text-muted">by {entry.mine ? 'you' : entry.nominatedBy}</span>
							{#if entry.mine || isOwner}
								<form method="POST" action="?/withdraw" use:enhance={keep(entry.id)}>
									<input type="hidden" name="nominationId" value={entry.id} />
									<button disabled={busy !== null} class="text-curtain underline">Withdraw</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-3 text-sm text-muted">Nothing yet. Be the first to pick something.</p>
		{/if}
	</section>

	{#if data.picker}
		<section class="mt-10 rounded-2xl border border-line bg-panel/50 p-4 sm:p-6">
			<h2 class="font-display text-2xl tracking-wide">
				{nominationsLeft > 0 ? 'Pick your nominations' : 'You’re all set'}
			</h2>
			{#if nominationsLeft > 0}
				<p class="text-sm text-muted">
					{nominationsLeft} left. Your watchlist comes first, the films you've wanted longest at the front.
				</p>

				{#snippet pickGrid(items: PickItem[])}
					<ul class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each items as { movie, status, wantCount } (movie.tmdbId)}
							<li>
								<MovieCard movie={cardMovie(movie)} {status} {wantCount} />
								<form method="POST" action="?/nominate" use:enhance={keep(`nom-${movie.tmdbId}`)}>
									<input type="hidden" name="tmdbId" value={movie.tmdbId} />
									<button
										disabled={busy !== null}
										class="mt-1.5 w-full rounded-lg border border-marquee/60 py-1.5 text-sm font-semibold text-marquee hover:bg-marquee/10"
									>
										{busy === `nom-${movie.tmdbId}` ? 'Nominating…' : 'Nominate'}
									</button>
								</form>
							</li>
						{/each}
					</ul>
				{/snippet}

				<h3 class="mt-6 text-sm font-semibold">From your watchlist</h3>
				{#if data.picker.mine.length}
					{@render pickGrid(data.picker.mine.map((m) => ({ movie: m, status: m })))}
				{:else}
					<p class="mt-1 text-sm text-muted">
						Nothing left on your <a href={resolve('/watchlist')} class="underline">watchlist</a> to nominate.
						Try below.
					</p>
				{/if}

				{#if data.picker.group.length}
					<h3 class="mt-8 text-sm font-semibold">Friends want these</h3>
					{@render pickGrid(
						data.picker.group.map((g) => ({
							movie: g.movie,
							status: g.movie,
							wantCount: g.wantCount
						}))
					)}
				{/if}

				{#if data.picker.searchEnabled}
					<h3 class="mt-8 text-sm font-semibold">Or search for anything</h3>
					<form
						method="GET"
						class="mt-2 flex gap-2"
						data-sveltekit-keepfocus
						data-sveltekit-noscroll
					>
						<input
							name="q"
							type="search"
							value={data.picker.q}
							placeholder="Search for a movie…"
							aria-label="Search movies to nominate"
							class="field mt-0 flex-1"
						/>
						<button class="btn w-auto px-4">Search</button>
					</form>
					{#if data.picker.search?.error}
						<p class="mt-3 text-sm text-curtain">{data.picker.search.error}</p>
					{:else if data.picker.search}
						{#if data.picker.search.results.length}
							{@render pickGrid(
								data.picker.search.results.map((r) => ({
									movie: { ...r, tmdbRating: r.rating === null ? null : r.rating * 10 },
									status: {
										seerrStatus: r.availability,
										radarrStatus: r.radarrStatus,
										radarrProgress: r.radarrProgress
									}
								}))
							)}
						{:else}
							<p class="mt-3 text-sm text-muted">No movies found (or they're already nominated).</p>
						{/if}
					{/if}
				{/if}
			{:else}
				<p class="text-sm text-muted">
					You've used all your nominations. Withdraw one above if you change your mind.
				</p>
			{/if}
		</section>
	{/if}

	<!-- ───────────── Voting ───────────── -->
{:else if night.status === 'voting'}
	<section class="mt-8">
		<div class="flex flex-wrap items-end justify-between gap-2">
			<h2 class="font-display text-2xl tracking-wide">Cast your votes</h2>
			<p class="text-sm text-muted">
				<span class="text-ink">{votesLeft} of {night.maxVotes}</span> votes left ·
				{data.voterCount} of {data.memberCount} people have voted
			</p>
		</div>
		<p class="mt-1 text-sm text-muted">
			Give up to {night.maxVotes} films a vote each. You can change your mind until voting closes.
			{#if night.resultsHidden}Counts stay hidden until the reveal.{/if}
		</p>

		{#if data.entries.length}
			<ul class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each data.entries as entry (entry.id)}
					{@const own = entry.mine && !night.selfVoteAllowed}
					<li>
						<MovieCard movie={cardMovie(entry.movie)} status={entry.movie} />
						<p class="mt-1 truncate text-xs text-muted">
							by {entry.mine ? 'you' : entry.nominatedBy}{#if entry.votes !== null}
								· <span class="text-ink">{entry.votes} vote{entry.votes === 1 ? '' : 's'}</span
								>{/if}
						</p>
						<form
							method="POST"
							action={entry.votedByMe ? '?/unvote' : '?/vote'}
							use:enhance={keep(entry.id)}
						>
							<input type="hidden" name="nominationId" value={entry.id} />
							<button
								aria-pressed={entry.votedByMe}
								disabled={busy !== null || own || (!entry.votedByMe && votesLeft <= 0)}
								class="mt-1.5 w-full rounded-lg py-1.5 text-sm font-semibold transition disabled:opacity-40 {entry.votedByMe
									? 'bg-marquee text-screen'
									: 'border border-marquee/60 text-marquee hover:bg-marquee/10'}"
							>
								{own ? 'Your pick' : entry.votedByMe ? '★ Voted' : '☆ Vote'}
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-4 text-sm text-muted">Nothing was nominated for this night.</p>
		{/if}
	</section>

	<!-- ───────────── Results ───────────── -->
{:else if night.status === 'closed'}
	{#if winner}
		<section
			class="mt-8 flex flex-col gap-6 rounded-2xl border border-marquee/40 bg-gradient-to-br from-marquee/10 to-transparent p-5 sm:flex-row sm:p-8"
		>
			<a
				href={resolve('/movie/[tmdbId]', { tmdbId: String(winner.movie.tmdbId) })}
				class="w-40 shrink-0 self-center sm:w-48"
			>
				{#if imageUrl(winner.movie.posterPath, 'w342')}
					<img
						src={imageUrl(winner.movie.posterPath, 'w342')}
						alt="{winner.movie.title} poster"
						class="w-full rounded-xl shadow-2xl ring-1 ring-marquee/50"
					/>
				{/if}
			</a>
			<div class="min-w-0 self-center">
				<p class="text-xs tracking-widest text-marquee uppercase">🏆 The winner is</p>
				<h2 class="mt-1 font-display text-4xl leading-none tracking-wide sm:text-5xl">
					{winner.movie.title}
				</h2>
				<p class="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
					<span class="text-ink">{winner.votes} vote{winner.votes === 1 ? '' : 's'}</span>
					<span>nominated by {winner.mine ? 'you' : winner.nominatedBy}</span>
					<StatusBadge status={winner.movie} />
				</p>
				{#if tieText}<p class="mt-3 text-sm">{tieText}</p>{/if}
			</div>
		</section>

		<section class="mt-8">
			<h2 class="font-display text-2xl tracking-wide">Full results</h2>
			<ol class="mt-3 divide-y divide-line rounded-xl border border-line bg-panel">
				{#each data.entries as entry (entry.id)}
					<li class="flex items-center gap-3 p-3">
						<span class="w-6 text-center font-display text-xl text-muted">{entry.rank}</span>
						{#if imageUrl(entry.movie.posterPath, 'w185')}
							<img
								src={imageUrl(entry.movie.posterPath, 'w185')}
								alt=""
								class="h-14 w-10 rounded object-cover"
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<a
								href={resolve('/movie/[tmdbId]', { tmdbId: String(entry.movie.tmdbId) })}
								class="block truncate font-medium hover:underline">{entry.movie.title}</a
							>
							<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-screen">
								<div
									class="h-full rounded-full {entry.rank === 1 ? 'bg-marquee' : 'bg-muted/50'}"
									style="width: {((entry.votes ?? 0) / maxVotes) * 100}%"
								></div>
							</div>
							<p class="mt-1 truncate text-xs text-muted">
								by {entry.mine ? 'you' : entry.nominatedBy} · on {entry.saves} watchlist{entry.saves ===
								1
									? ''
									: 's'}
							</p>
						</div>
						<span class="text-sm tabular-nums"
							>{entry.votes} vote{entry.votes === 1 ? '' : 's'}</span
						>
					</li>
				{/each}
			</ol>
		</section>
	{:else}
		<p class="mt-8 rounded-xl border border-line bg-panel p-6 text-muted">
			Voting closed with nothing nominated, so there's no winner this time.
		</p>
	{/if}
{/if}
