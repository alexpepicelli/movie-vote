<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import type { JobStatus } from '#lib/server/jobs.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let backingUp = $state(false);
	let refreshing = $state(false);

	const size = (bytes: number) =>
		bytes < 1024 * 1024
			? `${Math.max(1, Math.round(bytes / 1024))} KB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`;

	type Tone = 'ok' | 'idle' | 'error';
	const TONES: Record<Tone, string> = {
		ok: 'bg-live/15 text-live ring-live/30',
		idle: 'bg-white/5 text-muted ring-white/10',
		error: 'bg-danger/15 text-danger ring-danger/30'
	};
	const DOTS: Record<Tone, string> = {
		ok: 'bg-live',
		idle: 'bg-muted/60',
		error: 'bg-danger'
	};

	/** A job is unhealthy if its most recent run failed. */
	const jobTone = (j: JobStatus): Tone =>
		!j.lastRun ? 'idle' : j.lastError && j.lastError.at >= j.lastRun ? 'error' : 'ok';

	const services = $derived([
		{ name: 'Seerr', check: data.services.seerr },
		{ name: 'Radarr', check: data.services.radarr }
	]);

	const jobs = $derived([
		{
			name: 'Radarr status poller',
			blurb: 'Every 5 minutes, for watchlisted and nominated movies.',
			idle: 'Waits for a Radarr API key.',
			latest: undefined as Date | undefined,
			status: data.jobs.poller
		},
		{
			name: 'Deadline scheduler',
			blurb: 'Every minute: opens voting and closes nights on time.',
			idle: 'Not run yet.',
			latest: undefined,
			status: data.jobs.scheduler
		},
		{
			name: 'Daily backup',
			blurb: `Once a day, keeping ${data.backups.keepDays} days.`,
			idle: 'No backups yet.',
			// Today's backup may predate this server start, in which case the job hasn't needed to run.
			latest: data.backups.list[0]?.createdAt,
			status: data.jobs.backups
		}
	]);
</script>

<svelte:head><title>Health · Votarr</title></svelte:head>

{#snippet pill(tone: Tone, label: string)}
	<span
		class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 {TONES[
			tone
		]}"
	>
		<span class="size-1.5 rounded-full {DOTS[tone]}" aria-hidden="true"></span>
		{label}
	</span>
{/snippet}

<div class="flex items-center justify-between gap-3">
	<p class="text-sm text-muted">
		Server started <LocalTime date={data.server.startedAt} /> · {data.server.timeZone} · Node {data
			.server.node}
	</p>
	<button
		class="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent"
		disabled={refreshing}
		onclick={async () => {
			refreshing = true;
			await invalidateAll();
			refreshing = false;
		}}>{refreshing ? 'Checking…' : 'Check again'}</button
	>
</div>

<div class="mt-6 grid gap-6 lg:grid-cols-2">
	<section class="rounded-2xl border border-line bg-panel p-5">
		<h2 class="font-display text-2xl">Connections</h2>
		<ul class="mt-3 divide-y divide-line">
			<li class="flex items-center justify-between gap-3 py-2.5">
				<div>
					<p>Database</p>
					<p class="text-xs break-all text-muted">
						{data.database.path} · {size(data.database.size)}
					</p>
				</div>
				{#if data.database.check.status === 'ok'}
					{@render pill('ok', `OK · ${data.database.check.latencyMs} ms`)}
				{:else}
					{@render pill('error', 'Error')}
				{/if}
			</li>
			{#each services as svc (svc.name)}
				<li class="flex items-center justify-between gap-3 py-2.5">
					<div>
						<p>{svc.name}</p>
						<p class="text-xs text-muted">
							{#if svc.check.status === 'ok'}
								{svc.check.version ? `v${svc.check.version} · ` : ''}{svc.check.latencyMs} ms
							{:else if svc.check.status === 'error'}
								<span class="text-danger">{svc.check.error}</span>
							{:else}
								No API key. <a href={resolve('/admin/settings')} class="underline">Set it up</a>
							{/if}
						</p>
					</div>
					{@render pill(
						svc.check.status === 'ok' ? 'ok' : svc.check.status === 'error' ? 'error' : 'idle',
						svc.check.status === 'ok'
							? 'Connected'
							: svc.check.status === 'error'
								? 'Error'
								: 'Not set up'
					)}
				</li>
			{/each}
			<li class="flex items-center justify-between gap-3 py-2.5">
				<div>
					<p>Live updates</p>
					<p class="text-xs text-muted">Browsers currently open on Votarr.</p>
				</div>
				{@render pill(data.liveConnections ? 'ok' : 'idle', String(data.liveConnections))}
			</li>
		</ul>
	</section>

	<section class="rounded-2xl border border-line bg-panel p-5">
		<h2 class="font-display text-2xl">Background jobs</h2>
		<ul class="mt-3 divide-y divide-line">
			{#each jobs as job (job.name)}
				{@const tone = !job.status.lastRun && job.latest ? 'ok' : jobTone(job.status)}
				<li class="py-2.5">
					<div class="flex items-center justify-between gap-3">
						<p>{job.name}</p>
						{@render pill(tone, tone === 'ok' ? 'OK' : tone === 'error' ? 'Failing' : 'Waiting')}
					</div>
					<p class="text-xs text-muted">
						{job.blurb}
						{#if job.status.lastSuccess}
							Last success <LocalTime date={job.status.lastSuccess} />.
						{:else if job.latest}
							Latest backup <LocalTime date={job.latest} />.
						{:else}
							{job.idle}
						{/if}
					</p>
					{#if job.status.lastError}
						<p class="mt-1 text-xs text-danger">
							Last error <LocalTime date={job.status.lastError.at} />: {job.status.lastError
								.message}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 class="font-display text-2xl">Backups</h2>
				<p class="text-sm text-muted">
					A copy of the database is made once a day and kept for {data.backups.keepDays} days, in
					<code class="text-xs break-all">{data.backups.dir}</code>. To restore, stop Votarr and
					copy a backup over <code class="text-xs">votarr.db</code>.
				</p>
			</div>
			<form
				method="POST"
				action="?/backup"
				use:enhance={() => {
					backingUp = true;
					return async ({ update }) => {
						await update();
						backingUp = false;
					};
				}}
			>
				<button class="btn w-auto px-5" disabled={backingUp}
					>{backingUp ? 'Backing up…' : 'Back up now'}</button
				>
			</form>
		</div>

		{#if form?.error}
			<p class="mt-3 text-sm text-danger" role="alert">{form.error}</p>
		{:else if form?.backedUp}
			<p class="mt-3 text-sm text-live" role="status">Saved {form.backedUp}.</p>
		{/if}

		{#if data.backups.list.length}
			<ul class="mt-4 divide-y divide-line text-sm">
				{#each data.backups.list as b (b.name)}
					<li class="flex items-center justify-between gap-3 py-2">
						<span class="font-mono text-xs break-all">{b.name}</span>
						<span class="shrink-0 text-muted"
							><LocalTime date={b.createdAt} /> · {size(b.size)}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-4 text-sm text-muted">No backups yet.</p>
		{/if}
	</section>
</div>
