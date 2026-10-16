<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import Countdown from '#lib/components/Countdown.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import MovieCard from '#lib/components/MovieCard.svelte';
	import Poster from '#lib/components/Poster.svelte';
	import SectionHeader from '#lib/components/SectionHeader.svelte';
	import SegmentedControl from '#lib/components/SegmentedControl.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import VoteControl from '#lib/components/VoteControl.svelte';
	import WinnerReveal from '#lib/components/WinnerReveal.svelte';
	import WhosIn from '#lib/components/WhosIn.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import AvatarStack from '#lib/components/AvatarStack.svelte';
	import { cardMovie, displayStatus, type StatusInput } from '#lib/status.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type PickItem = {
		movie: Parameters<typeof cardMovie>[0];
		status: StatusInput;
		wantCount?: number;
	};
	const night = $derived(data.night);
	const isOwner = $derived(data.user?.role === 'owner');
	const open = $derived(night.status === 'nominating' || night.status === 'voting');
	const finished = $derived(night.status === 'closed' || night.status === 'watched');

	const nominationsLeft = $derived(night.maxNominations - data.myNominationCount);
	const votesLeft = $derived(night.maxVotes - data.myVoteCount);
	const deadline = $derived(
		night.status === 'nominating'
			? night.nominateUntil
			: night.status === 'voting'
				? night.voteUntil
				: null
	);

	// Stay on this page (and keep any search) after every action; show errors inline.
	let busy = $state<string | null>(null);
	const keep =
		(key: string, after?: () => void): SubmitFunction =>
		() => {
			busy = key;
			return async ({ result, update }) => {
				await update({ reset: false, navigate: false });
				busy = null;
				if (result.type === 'success') after?.();
			};
		};

	const confirmFirst =
		(message: string, key: string): SubmitFunction =>
		(input) => {
			if (!confirm(message)) return input.cancel();
			return keep(key)(input);
		};

	// Voting: a filter, and an undo toast after taking a vote back.
	let filter = $state<'all' | 'mine'>('all');
	const ballot = $derived(
		filter === 'mine' ? data.entries.filter((e) => e.myVote !== null) : data.entries
	);
	let undo = $state<{ id: string; title: string; value: number } | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;
	let undoForm = $state<HTMLFormElement>();
	function offerUndo(id: string, title: string, value: number) {
		clearTimeout(undoTimer);
		undo = { id, title, value };
		undoTimer = setTimeout(() => (undo = null), 5000);
	}
	// use:enhance keeps the handler from the first render, so read the entry when it's submitted.
	const voteSubmit =
		(
			current: () => { id: string; myVote: number | null; movie: { title: string } }
		): SubmitFunction =>
		(input) => {
			const { id, myVote, movie } = current();
			const clearing = input.action.search.includes('unvote') && myVote !== null;
			return keep(id, clearing ? () => offerUndo(id, movie.title, myVote) : undefined)(input);
		};
	function undoVote() {
		undoForm?.requestSubmit();
		clearTimeout(undoTimer);
		undo = null;
	}

	const titleOf = (tmdbId: number) =>
		data.entries.find((e) => e.movie.tmdbId === tmdbId)?.movie.title ?? 'another film';
	const winner = $derived(finished ? data.entries[0] : undefined);
	const winnerStatus = $derived(winner ? displayStatus(winner.movie) : null);

	let hoverScore = $state(0);
	const myScore = $derived(data.ratings?.mine?.score ?? 0);
	const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
	const tieBreak = $derived(night.results?.tieBreak);
	const tieText = $derived.by(() => {
		if (!winner || !tieBreak || tieBreak.by === 'none') return null;
		const others = new Intl.ListFormat('en', { type: 'conjunction' }).format(
			tieBreak.tiedWith.map(titleOf)
		);
		if (tieBreak.by === 'ups') return `Tied on score with ${others}. Won by having more upvotes.`;
		if (tieBreak.by === 'saves')
			return `Tied on score and upvotes with ${others}. Won by being on more watchlists.`;
		return `Tied on score, upvotes and watchlists with ${others}. Won the random draw (seed ${tieBreak.seed}).`;
	});
	const topScore = $derived(Math.max(1, ...data.entries.map((e) => e.votes?.score ?? 0)));
	const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

	const runtime = (mins: number | null) =>
		mins ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : null;
	const meta = (m: { year: number | null; runtime: number | null; genres: string[] | null }) =>
		[m.year, runtime(m.runtime), m.genres?.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
	const plural = (count: number, word: string, many = `${word}s`) =>
		`${count} ${count === 1 ? word : many}`;
</script>

<svelte:head><title>{night.title} · Votarr</title></svelte:head>

{#snippet dots(used: number, total: number)}
	<span class="flex gap-1.5" aria-hidden="true">
		{#each Array.from({ length: total }, (_, n) => n) as i (i)}
			<span
				class="size-2.5 rounded-full transition {i < used
					? 'bg-accent shadow-[0_0_8px_rgba(255,79,154,0.7)]'
					: 'border-[1.5px] border-muted/50'}"
			></span>
		{/each}
	</span>
{/snippet}

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-x-10">
	<!-- ───────────── Header ───────────── -->
	<header class="card relative animate-rise overflow-hidden p-5 sm:p-6 lg:col-start-1">
		<div
			class="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden"
			aria-hidden="true"
		>
			<div class="retro-sun -top-6 right-4 size-32 opacity-25"></div>
			<div class="retro-grid h-16 opacity-60"></div>
		</div>
		<div class="relative flex flex-col gap-4 pt-8">
			<div>
				<p class="eyebrow">Movie night</p>
				<h1 class="mt-1 font-display text-4xl leading-[0.95] text-sunset sm:text-5xl">
					{night.title}
				</h1>
				{#if night.scheduledFor}
					<p class="mt-1.5 text-sm text-muted"><LocalTime date={night.scheduledFor} /></p>
				{/if}
			</div>
			<Stepper status={night.status} />
		</div>
	</header>

	<!-- ───────────── Side panel: sticky on desktop, under the header on mobile ───────────── -->
	<aside
		class="flex animate-rise flex-col gap-4 [animation-delay:60ms] lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
	>
		{#if open}
			<div class="grid grid-cols-2 gap-3">
				<StatTile label="Closes in" live={!!deadline}>
					{#if deadline}<Countdown to={deadline} format="clock" />{:else}Owner{/if}
				</StatTile>
				{#if night.status === 'voting'}
					<StatTile label="Voted"
						>{data.voterCount}<span class="ml-1 text-base text-muted"
							>/&nbsp;{data.memberCount}</span
						></StatTile
					>
				{:else}
					<StatTile label="Nominated">{data.entries.length}</StatTile>
				{/if}
			</div>
			{#if deadline}
				<p class="-mt-2 text-xs text-muted">
					{night.status === 'voting' ? 'Voting closes' : 'Nominations close'}
					<LocalTime date={deadline} />
				</p>
			{/if}

			<div class="card hidden items-center justify-between gap-3 p-4 lg:flex">
				{#if night.status === 'voting'}
					<span class="text-sm"><strong>{votesLeft} of {night.maxVotes}</strong> votes left</span>
					{@render dots(data.myVoteCount, night.maxVotes)}
				{:else}
					<span class="text-sm"
						><strong>{nominationsLeft} of {night.maxNominations}</strong> picks left</span
					>
					{@render dots(data.myNominationCount, night.maxNominations)}
				{/if}
			</div>
		{/if}

		<WhosIn people={data.people} nightId={night.id} canJoin={night.status !== 'watched'} />

		{#if isOwner && night.status !== 'watched'}
			<div class="card flex flex-col gap-3 border-dashed p-4">
				<p class="font-mono text-[11px] tracking-wider text-muted uppercase">Owner</p>
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
						<button disabled={busy !== null} class="btn">Start voting now</button>
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
						<button disabled={busy !== null} class="btn">Close voting</button>
					</form>
				{:else if night.status === 'closed' && winner}
					<form method="POST" action="?/markWatched" use:enhance={keep('markWatched')}>
						<button disabled={busy !== null} class="btn">We watched it: open ratings</button>
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
					<button
						disabled={busy !== null}
						class="min-h-10 text-sm font-semibold text-danger hover:underline">Cancel night</button
					>
				</form>
			</div>
		{/if}
	</aside>

	<!-- ───────────── Phase content ───────────── -->
	<div class="flex min-w-0 flex-col gap-8 lg:col-start-1">
		{#if form?.error}
			<p class="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm" role="alert">
				{form.error}
			</p>
		{/if}

		{#if night.status === 'nominating'}
			<!-- Nominating -->
			<section>
				<SectionHeader title="Nominated so far">
					<span class="font-mono text-muted">{data.entries.length}</span>
				</SectionHeader>
				{#if data.entries.length}
					<ul class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
						{#each data.entries as entry (entry.id)}
							<li>
								<MovieCard
									movie={cardMovie(entry.movie)}
									status={entry.movie}
									wantCount={entry.saves}
								/>
								<div class="mt-1 flex items-center justify-between gap-2 text-xs">
									<span class="flex min-w-0 items-center gap-1.5 text-muted">
										<Avatar
											id={entry.userId}
											name={entry.nominatedBy}
											hasAvatar={entry.nominatorHasAvatar}
											size={20}
										/>
										<span class="truncate">by {entry.mine ? 'you' : entry.nominatedBy}</span>
									</span>
									{#if entry.mine || isOwner}
										<form method="POST" action="?/withdraw" use:enhance={keep(entry.id)}>
											<input type="hidden" name="nominationId" value={entry.id} />
											<button
												disabled={busy !== null}
												class="min-h-8 font-semibold text-danger hover:underline">Withdraw</button
											>
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
				<section class="card p-4 sm:p-6">
					<h2 class="font-display text-2xl">
						{nominationsLeft > 0 ? 'Pick your nominations' : 'You’re all set'}
					</h2>
					{#if nominationsLeft > 0}
						<p class="mt-1 text-sm text-muted">
							{plural(nominationsLeft, 'pick')} left. Your watchlist comes first, the films you've wanted
							longest at the front.
						</p>

						{#snippet pickGrid(items: PickItem[])}
							<ul class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
								{#each items as { movie, status, wantCount } (movie.tmdbId)}
									<li>
										<MovieCard movie={cardMovie(movie)} {status} {wantCount} />
										<form
											method="POST"
											action="?/nominate"
											use:enhance={keep(`nom-${movie.tmdbId}`)}
										>
											<input type="hidden" name="tmdbId" value={movie.tmdbId} />
											<button
												disabled={busy !== null}
												class="btn-ghost mt-2 min-h-10 w-full text-sm"
											>
												{#if busy === `nom-${movie.tmdbId}`}
													Nominating…
												{:else}
													<Icon name="plus" size={16} /> Nominate
												{/if}
											</button>
										</form>
									</li>
								{/each}
							</ul>
						{/snippet}

						<h3 class="mt-6 font-bold">From your watchlist</h3>
						{#if data.picker.mine.length}
							{@render pickGrid(data.picker.mine.map((m) => ({ movie: m, status: m })))}
						{:else}
							<p class="mt-1 text-sm text-muted">
								Nothing left on your <a href={resolve('/watchlist')} class="link">watchlist</a> to nominate.
								Try below.
							</p>
						{/if}

						{#if data.picker.group.length}
							<h3 class="mt-8 font-bold">Friends want these</h3>
							{@render pickGrid(
								data.picker.group.map((g) => ({
									movie: g.movie,
									status: g.movie,
									wantCount: g.wantCount
								}))
							)}
						{/if}

						{#if data.picker.searchEnabled}
							<h3 class="mt-8 font-bold">Or search for anything</h3>
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
								<button class="btn w-auto">Search</button>
							</form>
							{#if data.picker.search?.error}
								<p class="mt-3 text-sm text-danger">{data.picker.search.error}</p>
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
									<p class="mt-3 text-sm text-muted">
										No movies found (or they're already nominated).
									</p>
								{/if}
							{/if}
						{/if}
					{:else}
						<p class="mt-1 text-sm text-muted">
							You've used all your nominations. Withdraw one above if you change your mind.
						</p>
					{/if}
				</section>
			{/if}
		{:else if night.status === 'voting'}
			<!-- Voting -->
			<section class="flex flex-col gap-4">
				<SectionHeader title="Ballot" />
				<p class="-mt-2 text-sm text-muted">
					You have {night.maxVotes} votes: give a film ▲ if you want it, ▼ if you don't. Highest score
					wins, and you can change your mind until voting closes.
					{#if night.secretBallot}
						Secret ballot: scores stay hidden until voting closes, and nobody sees who voted for
						what.
					{:else}
						Votes are public: you'll see who backs what as it happens.
					{/if}
				</p>
				<SegmentedControl
					label="Show"
					items={[
						{
							label: `All ${data.entries.length}`,
							active: filter === 'all',
							onclick: () => (filter = 'all')
						},
						{
							label: `Your votes (${data.myVoteCount})`,
							active: filter === 'mine',
							onclick: () => (filter = 'mine')
						}
					]}
				/>

				{#if ballot.length}
					<ul class="flex flex-col gap-3">
						{#each ballot as entry, i (entry.id)}
							{@const own = entry.mine && !night.selfVoteAllowed}
							<li
								class="flex animate-rise gap-3 rounded-2xl p-3 transition sm:gap-4 sm:p-4 {entry.myVote ===
								1
									? 'bg-raised ring-[1.5px] ring-accent'
									: entry.myVote === -1
										? 'bg-raised ring-[1.5px] ring-sunset/70'
										: 'bg-panel ring-1 ring-line'}"
								style="animation-delay: {i * 40}ms"
							>
								<a
									href={resolve('/movie/[tmdbId]', { tmdbId: String(entry.movie.tmdbId) })}
									class="w-16 shrink-0 self-start sm:w-20"
									aria-label="{entry.movie.title} details"
								>
									<Poster path={entry.movie.posterPath} title={entry.movie.title} size="w185" />
								</a>
								<div class="flex min-w-0 flex-1 flex-col gap-1">
									<h3 class="leading-tight font-bold sm:text-lg">{entry.movie.title}</h3>
									<p class="text-xs text-muted">{meta(entry.movie)}</p>
									{#if entry.movie.overview}
										<p class="line-clamp-2 text-sm text-ink/80">{entry.movie.overview}</p>
									{/if}
									<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
										<StatusBadge status={entry.movie} />
										<span class="flex items-center gap-1.5">
											<Avatar
												id={entry.userId}
												name={entry.nominatedBy}
												hasAvatar={entry.nominatorHasAvatar}
												size={18}
											/>
											{entry.mine ? 'Your pick' : entry.nominatedBy}
										</span>
										{#if entry.votes !== null && (entry.votes.ups || entry.votes.downs)}
											<span class="font-mono"
												><span class="text-accent">▲{entry.votes.ups}</span>
												<span class="text-sunset">▼{entry.votes.downs}</span></span
											>
										{/if}
									</div>
									{#if entry.voters?.length}
										<div class="mt-1">
											<AvatarStack
												people={entry.voters}
												label="Votes on {entry.movie.title}"
												size={24}
											/>
										</div>
									{/if}
								</div>
								<VoteControl
									nominationId={entry.id}
									title={entry.movie.title}
									myVote={entry.myVote}
									score={entry.votes?.score ?? null}
									canVote={votesLeft > 0}
									ownPick={own}
									busy={busy !== null}
									submit={voteSubmit(() => entry)}
								/>
							</li>
						{/each}
					</ul>
				{:else if filter === 'mine'}
					<p class="py-10 text-center text-muted">You haven't voted yet.</p>
				{:else}
					<p class="text-sm text-muted">Nothing was nominated for this night.</p>
				{/if}

				<form method="POST" action="?/vote" bind:this={undoForm} use:enhance={keep('undo')} hidden>
					<input type="hidden" name="nominationId" value={undo?.id ?? ''} />
					<input type="hidden" name="value" value={undo?.value === -1 ? 'down' : 'up'} />
				</form>
			</section>

			<!-- Sticky vote bar on phones and tablets; the side panel covers desktop. -->
			<div class="sticky bottom-20 z-10 flex flex-col gap-3 sm:bottom-4 lg:hidden">
				{#if undo}
					<Toast message="Vote on {undo.title} removed" action="Undo" onaction={undoVote} />
				{/if}
				<div
					class="flex items-center gap-3 rounded-2xl border border-line bg-screen/95 px-4 py-3 backdrop-blur"
				>
					{@render dots(data.myVoteCount, night.maxVotes)}
					<span class="flex-1 text-sm font-semibold"
						>{votesLeft === 0
							? `All ${night.maxVotes} votes used`
							: `${plural(votesLeft, 'vote')} left`}</span
					>
					<a href={resolve('/')} class="btn min-h-10 w-auto px-5">Done</a>
				</div>
			</div>
			{#if undo}
				<div class="fixed right-6 bottom-6 z-30 hidden w-96 lg:block">
					<Toast message="Vote on {undo.title} removed" action="Undo" onaction={undoVote} />
				</div>
			{/if}
		{:else if finished}
			<!-- Results -->
			{#if winner}
				<WinnerReveal
					storageKey="votarr-revealed-{night.id}"
					title={winner.movie.title}
					count={data.entries.length}
				>
					<section class="card relative flex flex-col gap-6 overflow-hidden p-5 sm:flex-row sm:p-7">
						<div
							class="pointer-events-none absolute inset-x-0 bottom-0 h-24 overflow-hidden"
							aria-hidden="true"
						>
							<div class="retro-grid h-24 opacity-40"></div>
						</div>
						<a
							href={resolve('/movie/[tmdbId]', { tmdbId: String(winner.movie.tmdbId) })}
							class="relative w-36 shrink-0 self-center sm:w-44"
						>
							<Poster
								path={winner.movie.posterPath}
								title={winner.movie.title}
								class="shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-2 ring-accent/60"
							/>
						</a>
						<div class="relative min-w-0 self-center">
							<p class="eyebrow">
								{night.status === 'watched' ? 'We watched' : "Tonight's feature"}
							</p>
							<h2 class="mt-1 font-display text-4xl leading-[0.95] text-sunset sm:text-5xl">
								{winner.movie.title}
							</h2>
							<p class="mt-2 text-sm text-muted">{meta(winner.movie)}</p>
							<p class="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
								<span class="font-mono font-bold text-ink"
									>Score {signed(winner.votes?.score ?? 0)}</span
								>
								<span class="flex items-center gap-1.5">
									<Avatar
										id={winner.userId}
										name={winner.nominatedBy}
										hasAvatar={winner.nominatorHasAvatar}
										size={22}
									/>
									picked by {winner.mine ? 'you' : winner.nominatedBy}
								</span>
								<StatusBadge status={winner.movie} />
							</p>
							{#if tieText}<p class="mt-3 text-sm">{tieText}</p>{/if}

							{#if isOwner && night.status === 'closed' && winnerStatus?.kind === 'none'}
								<form method="POST" action="?/request" use:enhance={keep('request')} class="mt-4">
									<button
										disabled={busy !== null || !data.canRequest}
										class="btn w-auto"
										title={data.canRequest ? undefined : 'Seerr isn’t connected'}
									>
										<Icon name="download" size={18} />
										{busy === 'request' ? 'Requesting…' : 'Request via Seerr'}
									</button>
									<p class="mt-1 text-xs text-muted">
										Only you can see this. Seerr sends it to Radarr.
									</p>
								</form>
							{:else if form && 'requested' in form && form.requested}
								<p class="mt-4 text-sm text-live" role="status">
									{form.already
										? 'Already requested in Seerr.'
										: 'Requested! Radarr will pick it up shortly.'}
								</p>
							{/if}
						</div>
					</section>

					{#if night.status === 'watched' && data.ratings}
						<section class="card p-5 sm:p-6">
							<SectionHeader title="How was it?">
								{#if data.ratings.average !== null}
									<span>
										<span class="text-sunset" aria-hidden="true">{stars(data.ratings.average)}</span
										>
										<span class="text-muted">
											{data.ratings.average.toFixed(1)} from {plural(
												data.ratings.rows.length,
												'person',
												'people'
											)}
										</span>
									</span>
								{/if}
							</SectionHeader>

							<form method="POST" action="?/rate" use:enhance={keep('rate')} class="mt-4 space-y-3">
								<fieldset>
									<legend class="text-sm text-muted">
										{data.ratings.mine ? 'Your rating (tap to change)' : 'Your rating'}
									</legend>
									<div
										class="mt-1 flex gap-1 text-3xl"
										role="presentation"
										onmouseleave={() => (hoverScore = 0)}
									>
										{#each [1, 2, 3, 4, 5] as n (n)}
											<label
												class="cursor-pointer transition active:scale-90 {n <=
												(hoverScore || myScore)
													? 'text-sunset'
													: 'text-line'}"
												onmouseenter={() => (hoverScore = n)}
											>
												<input
													type="radio"
													name="score"
													value={n}
													checked={myScore === n}
													required
													class="sr-only"
													onchange={(e) => e.currentTarget.form?.requestSubmit()}
												/>
												<span aria-hidden="true">★</span>
												<span class="sr-only">{n} star{n === 1 ? '' : 's'}</span>
											</label>
										{/each}
									</div>
								</fieldset>
								<label class="block">
									<span class="text-sm text-muted">Comment (optional)</span>
									<input
										name="comment"
										maxlength={data.maxComment}
										value={data.ratings.mine?.comment ?? ''}
										placeholder="One-line review…"
										class="field"
									/>
								</label>
								<button disabled={busy !== null} class="btn w-auto">
									{data.ratings.mine ? 'Update rating' : 'Save rating'}
								</button>
							</form>

							{#if data.ratings.rows.length}
								<ul class="mt-6 divide-y divide-line">
									{#each data.ratings.rows as r (r.userId)}
										<li class="flex items-start gap-3 py-2 text-sm">
											<Avatar
												id={r.userId}
												name={r.displayName}
												hasAvatar={!!r.avatarUrl}
												size={26}
											/>
											<span class="text-sunset" aria-label="{r.score} stars">{stars(r.score)}</span>
											<span class="min-w-0">
												<span class="font-semibold">{r.displayName}</span>
												{#if r.comment}<span class="text-muted">: “{r.comment}”</span>{/if}
											</span>
										</li>
									{/each}
								</ul>
							{/if}
						</section>
					{/if}

					<section>
						<SectionHeader title="Results" />
						<ol class="mt-4 flex flex-col gap-4">
							{#each data.entries as entry, i (entry.id)}
								<li class="flex items-center gap-3">
									<span
										class="w-6 font-mono text-sm font-bold {i === 0 ? 'text-accent' : 'text-muted'}"
										>{String(entry.rank).padStart(2, '0')}</span
									>
									<div class="min-w-0 flex-1">
										<div class="flex justify-between gap-3 text-sm">
											<a
												href={resolve('/movie/[tmdbId]', { tmdbId: String(entry.movie.tmdbId) })}
												class="truncate hover:underline {i === 0
													? 'font-extrabold'
													: 'font-semibold text-ink/85'}">{entry.movie.title}</a
											>
											<span class="shrink-0 font-mono text-muted">
												<span class="text-accent">▲{entry.votes?.ups ?? 0}</span>
												<span class="text-sunset">▼{entry.votes?.downs ?? 0}</span>
												<span class="ml-1 font-bold text-ink"
													>{signed(entry.votes?.score ?? 0)}</span
												>
											</span>
										</div>
										<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
											<div
												class="bar h-full rounded-full {i === 0
													? 'bg-gradient-to-r from-[#ff8a4c] to-accent'
													: 'bg-muted/45'}"
												style="width: {(Math.max(0, entry.votes?.score ?? 0) / topScore) *
													100}%; animation-delay: {i * 80}ms"
											></div>
										</div>
										<div class="mt-1.5 flex items-center justify-between gap-3">
											<p class="truncate text-xs text-muted">
												by {entry.mine ? 'you' : entry.nominatedBy} · on {plural(
													entry.saves,
													'watchlist'
												)}
											</p>
											{#if entry.voters?.length}
												<AvatarStack
													people={entry.voters}
													label="Votes on {entry.movie.title}"
													size={20}
													max={4}
												/>
											{/if}
										</div>
									</div>
								</li>
							{/each}
						</ol>
					</section>
				</WinnerReveal>
			{:else}
				<p class="card p-6 text-muted">
					Voting closed with nothing nominated, so there's no winner this time.
				</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.bar {
		animation: grow 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		transform-origin: left;
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
	}
</style>
