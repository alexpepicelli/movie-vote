<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const INFO = {
		seerr: {
			name: 'Seerr',
			blurb: 'Movie search, details and requests. Friends also sign in with their Seerr accounts.',
			keyWhere: 'Seerr → Settings → General → API Key'
		},
		radarr: {
			name: 'Radarr',
			blurb: 'Shows whether a movie is on the server or downloading.',
			keyWhere: 'Radarr → Settings → General → API Key'
		}
	} as const;

	let busy = $state<string | null>(null);
	const track =
		(key: string): SubmitFunction =>
		({ action }) => {
			// A test only reports a result: don't reload, or the fields would reset to the saved values.
			const testing = action.search.includes('test');
			busy = testing ? `${key}-test` : key;
			return async ({ update }) => {
				await update({ reset: false, navigate: false, refreshAll: !testing });
				busy = null;
			};
		};

	const describe = (s: { status: string; error?: string }) =>
		s.status === 'ok'
			? 'Connected'
			: s.status === 'not_configured'
				? 'No API key yet'
				: `Can't connect: ${s.error}`;
</script>

<svelte:head><title>Settings · Votarr</title></svelte:head>

<p class="text-sm text-muted">
	Connect Votarr to your stack. On YAMS the addresses below already point at the right containers:
	you only need to paste the API keys.
</p>

<div class="mt-6 grid gap-6 lg:grid-cols-2">
	{#each data.services as svc (svc.service)}
		{@const info = INFO[svc.service]}
		{@const mine = form && 'service' in form && form.service === svc.service ? form : null}
		{@const shown = mine && 'tested' in mine && mine.tested ? mine.tested : svc.status}
		<section class="rounded-2xl border border-line bg-panel p-5">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="font-display text-2xl">{info.name}</h2>
					<p class="text-sm text-muted">{info.blurb}</p>
				</div>
				<span
					class="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 {shown.status ===
					'ok'
						? 'bg-live/15 text-live ring-live/30'
						: shown.status === 'not_configured'
							? 'bg-white/5 text-muted ring-white/10'
							: 'bg-danger/15 text-danger ring-danger/30'}"
				>
					<span
						class="size-1.5 rounded-full {shown.status === 'ok'
							? 'bg-live'
							: shown.status === 'not_configured'
								? 'bg-muted/60'
								: 'bg-danger'}"
						aria-hidden="true"
					></span>
					{shown.status === 'ok'
						? 'Connected'
						: shown.status === 'not_configured'
							? 'Not set up'
							: 'Error'}
				</span>
			</div>

			<form method="POST" action="?/save" use:enhance={track(svc.service)} class="mt-5 space-y-4">
				<input type="hidden" name="service" value={svc.service} />
				<label class="block">
					<span class="text-sm text-muted">URL</span>
					<input
						name="url"
						required
						defaultValue={svc.url}
						placeholder={svc.defaultUrl}
						autocomplete="off"
						spellcheck="false"
						class="field font-mono text-sm"
					/>
					{#if svc.urlSource === 'env'}
						<span class="mt-1 block text-xs text-muted"
							>From an environment variable. Saving here overrides it.</span
						>
					{/if}
				</label>

				<label class="block">
					<span class="text-sm text-muted">API key</span>
					<input
						name="apiKey"
						type="password"
						autocomplete="off"
						spellcheck="false"
						placeholder={svc.keyHint
							? `Saved, ends in ${svc.keyHint}. Leave blank to keep`
							: 'Paste the API key'}
						class="field font-mono text-sm"
					/>
					<span class="mt-1 block text-xs text-muted">
						{info.keyWhere}{#if svc.keySource === 'env'}. Currently set by an environment variable{/if}
					</span>
				</label>

				{#if svc.keySource === 'saved'}
					<label class="flex items-center gap-2 text-sm text-muted">
						<input type="checkbox" name="clearKey" class="accent-danger" /> Remove the saved key
					</label>
				{/if}

				<p
					class="text-sm {shown.status === 'ok'
						? 'text-live'
						: shown.status === 'error'
							? 'text-danger'
							: 'text-muted'}"
					role="status"
				>
					{#if mine && 'error' in mine && mine.error}
						<span class="text-danger">{mine.error}</span>
					{:else if mine && 'saved' in mine && mine.saved}
						Saved. {describe(
							svc.status
						)}{#if svc.status.status === 'ok' && svc.status.latencyMs !== undefined}&nbsp;({svc
								.status.latencyMs} ms){/if}
					{:else if mine && 'tested' in mine}
						Test: {describe(shown)}{#if shown.status === 'ok'}. Not saved yet{/if}
					{:else}
						{describe(shown)}
					{/if}
				</p>

				<div class="flex flex-wrap gap-3">
					<button disabled={busy !== null} class="btn w-auto px-5">
						{busy === svc.service ? 'Saving…' : 'Save'}
					</button>
					<button
						formaction="?/test"
						disabled={busy !== null}
						class="rounded-lg border border-line px-4 py-2 text-sm hover:border-accent"
					>
						{busy === `${svc.service}-test` ? 'Testing…' : 'Test connection'}
					</button>
				</div>
			</form>
		</section>
	{/each}
</div>
