<script lang="ts">
	import SynthScene from '#lib/components/SynthScene.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Countdown from '#lib/components/Countdown.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import NightTitle from '#lib/components/NightTitle.svelte';
	import Poster from '#lib/components/Poster.svelte';
	import SectionHeader from '#lib/components/SectionHeader.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import WhosIn from '#lib/components/WhosIn.svelte';
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
		n?.status === 'nominating' ? 'Nominating' : n?.status === 'voting' ? 'Voting' : 'Results'
	);
	const cta = $derived.by(() => {
		if (!n) return '';
		if (n.status === 'nominating') return n.nominationsLeft > 0 ? 'Nominate' : 'See nominations';
		if (n.status === 'voting') return n.votesLeft > 0 ? 'Vote now' : 'See ballot';
		return showWinner ? 'See results' : 'Reveal winner';
	});
</script>

<svelte:head><title>Votarr</title></svelte:head>

{#if data.needsConnecting}
	<a
		href={resolve('/admin/settings')}
		class="mb-6 flex animate-rise items-center justify-between gap-3 rounded-2xl border border-sunset/40 bg-sunset/10 p-4 text-sm"
	>
		<span>
			<span class="font-bold">Connect Seerr and Radarr</span>
		</span>
		<Icon name="arrow" class="text-sunset" />
	</a>
{/if}

<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
	<div class="flex min-w-0 flex-col gap-10">
		{#if n}
			<section class="card relative animate-rise overflow-hidden p-5 sm:p-7">
				<SynthScene />

				<div class="relative flex flex-col gap-5 pt-24 sm:pt-28">
					<div class="flex flex-col gap-2">
						<NightTitle title={n.title} label={eyebrow} />
					</div>

					<p class="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-muted">
						{#if n.scheduledFor}<span class="text-ink"><LocalTime date={n.scheduledFor} /></span
							>{/if}
						{#if n.status === 'nominating'}
							<span><strong class="text-ink">{n.nominationsLeft}</strong> picks left</span>
							<span>{n.nominationCount} nominated</span>
						{:else if n.status === 'voting'}
							<span><strong class="text-ink">{n.votesLeft}</strong> votes left</span>
							<span>{n.voterCount}/{n.memberCount} voted</span>
						{/if}
						{#if n.status !== 'closed'}
							{@const until = n.status === 'voting' ? n.voteUntil : n.nominateUntil}
							{#if until}
								<span class="text-live [text-shadow:0_0_10px_rgba(69,227,255,0.5)]"
									>closes in <Countdown to={until} format="clock" /></span
								>
							{/if}
						{/if}
					</p>

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
						<p class="text-sm text-muted">Nothing was nominated.</p>
					{/if}

					<div class="flex flex-col gap-3">
						<a href={resolve('/nights/[id]', { id: n.id })} class="btn">
							{cta}
							<Icon name="arrow" size={18} stroke={2.4} />
						</a>
					</div>
				</div>
			</section>

			{#if isOwner && n.status === 'closed'}
				<a href={resolve('/nights/new')} class="link -mt-6 text-sm">Start next night</a>
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
				<SynthScene />
				<div class="relative pt-24">
					<h1 class="font-display text-4xl text-sunset sm:text-5xl">
						Hey {data.user?.displayName}
					</h1>
					<p
						class="mt-10 font-semibold text-ink [text-shadow:0_1px_10px_var(--color-screen),0_0_4px_var(--color-screen)]"
					>
						No movie night planned yet.
					</p>
					<div class="mt-4 flex flex-wrap items-center gap-3">
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
	</aside>
</div>
