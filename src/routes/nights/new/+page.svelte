<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import NightTitle from '#lib/components/NightTitle.svelte';
	import SynthScene from '#lib/components/SynthScene.svelte';
	import { DEFAULT_THEME, THEMES } from '#lib/themes.js';
	import { themePreview } from '#lib/theme-preview.svelte.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);

	// Choosing a theme re-skins the whole page straight away.
	$effect(() => {
		themePreview.id = String(form?.values?.theme ?? DEFAULT_THEME);
		return () => (themePreview.id = null);
	});

	// The title card below previews what's typed.
	let typed = $state<string | null>(null);

	const v = (name: string, fallback = '') => String(form?.values?.[name] ?? fallback);
	const checked = (name: string, fallback: boolean) =>
		form?.values ? form.values[name] === 'on' : fallback;
</script>

<svelte:head><title>New movie night · Votarr</title></svelte:head>

<div class="mx-auto max-w-lg">
	<h1 class="font-display text-4xl text-sunset">Start a movie night</h1>

	{#if data.open}
		<p class="mt-4 rounded-xl border border-line bg-panel p-4 text-sm">
			<a href={resolve('/nights/[id]', { id: data.open.id })} class="link">{data.open.title}</a> is still
			open. Close or cancel it before starting another.
		</p>
	{:else}
		<p class="mt-2 text-sm text-muted">
			Nominations open as soon as you create it. Deadlines are optional: without them, you move
			things along yourself from the night's page.
		</p>

		<form
			method="POST"
			class="mt-6 space-y-5"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					await update({ reset: false });
					pending = false;
				};
			}}
		>
			<div class="card relative overflow-hidden p-5" aria-label="Title card preview">
				<SynthScene />
				<div class="relative pt-20">
					<NightTitle
						title={(typed ?? v('title', 'Movie night')) || 'Movie night'}
						label="Nominating"
					/>
				</div>
			</div>

			<label class="block">
				<span class="text-sm text-muted">Title</span>
				<input
					name="title"
					required
					maxlength="60"
					value={v('title', 'Movie night')}
					oninput={(e) => (typed = e.currentTarget.value)}
					class="field"
				/>
			</label>

			<fieldset>
				<legend class="text-sm text-muted">Theme</legend>
				<div class="mt-1 grid gap-3 sm:grid-cols-2">
					{#each THEMES as t (t.id)}
						<label class="theme-option">
							<input
								type="radio"
								name="theme"
								value={t.id}
								checked={v('theme', DEFAULT_THEME) === t.id}
								onchange={() => (themePreview.id = t.id)}
								class="sr-only"
							/>
							<span class="card flex items-center gap-3 p-3 transition">
								<span class="flex -space-x-1.5">
									{#each t.swatch as color (color)}
										<span
											class="size-6 rounded-full ring-2 ring-panel"
											style:background-color={color}
										></span>
									{/each}
								</span>
								<span>
									<span class="block font-semibold">{t.name}</span>
									<span class="block text-xs text-muted">{t.blurb}</span>
								</span>
							</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<label class="block">
				<span class="text-sm text-muted">When are you watching? (optional)</span>
				<input name="scheduledFor" type="datetime-local" value={v('scheduledFor')} class="field" />
			</label>

			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block">
					<span class="text-sm text-muted">Nominations close (optional)</span>
					<input
						name="nominateUntil"
						type="datetime-local"
						value={v('nominateUntil')}
						class="field"
					/>
				</label>
				<label class="block">
					<span class="text-sm text-muted">Voting closes (optional)</span>
					<input name="voteUntil" type="datetime-local" value={v('voteUntil')} class="field" />
				</label>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block">
					<span class="text-sm text-muted">Nominations per person</span>
					<input
						name="maxNominations"
						type="number"
						min="1"
						max="5"
						required
						value={v('maxNominations', '2')}
						class="field"
					/>
				</label>
				<label class="block">
					<span class="text-sm text-muted">Votes per person</span>
					<input
						name="maxVotes"
						type="number"
						min="1"
						max="10"
						required
						value={v('maxVotes', '3')}
						class="field"
					/>
				</label>
			</div>

			<fieldset class="space-y-3 rounded-xl border border-line p-4">
				<legend class="px-1 text-sm text-muted">Rules</legend>
				<label class="flex items-start gap-3">
					<input
						type="checkbox"
						name="secretBallot"
						checked={checked('secretBallot', false)}
						class="mt-1 accent-accent"
					/>
					<span>
						<span class="block text-sm">Secret ballot</span>
						<span class="block text-xs text-muted"
							>Scores stay hidden until voting closes, and nobody ever sees who voted for what.</span
						>
					</span>
				</label>
				<label class="flex items-start gap-3">
					<input
						type="checkbox"
						name="selfVoteAllowed"
						checked={checked('selfVoteAllowed', false)}
						class="mt-1 accent-accent"
					/>
					<span class="text-sm">Let people vote for their own nominations</span>
				</label>
			</fieldset>

			{#if form?.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
			<button disabled={pending} class="btn">{pending ? 'Creating…' : 'Open nominations'}</button>
		</form>
	{/if}
</div>
