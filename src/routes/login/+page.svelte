<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
	// Captured once: SvelteKit drops the query string from the URL after a failed form post.
	const redirectTo = page.url.searchParams.get('redirectTo') ?? '';
	const setupName = $derived(form && 'displayName' in form ? form.displayName : '');

	const submit = () => {
		pending = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			pending = false;
		};
	};
</script>

<svelte:head><title>Sign in · Votarr</title></svelte:head>

<div class="mx-auto max-w-sm pt-8">
	{#if data.needsSetup}
		<h1 class="font-display text-4xl tracking-wide">Set up Votarr</h1>
		<p class="mt-2 text-sm text-muted">
			Create the owner account. You'll be able to invite friends straight after.
			{#if data.seerrEnabled}
				Or skip this and sign in with your Seerr account below: the first person to sign in becomes
				the owner.
			{/if}
		</p>

		<form method="POST" action="?/setup" use:enhance={submit} class="mt-6 space-y-4">
			<label class="block">
				<span class="text-sm text-muted">Username</span>
				<input
					name="username"
					required
					autocomplete="username"
					value={form?.username ?? ''}
					class="field"
				/>
			</label>
			<label class="block">
				<span class="text-sm text-muted">Display name</span>
				<input name="displayName" required value={setupName ?? ''} class="field" />
			</label>
			<label class="block">
				<span class="text-sm text-muted">Password (8+ characters)</span>
				<input
					name="password"
					type="password"
					required
					minlength="8"
					autocomplete="new-password"
					class="field"
				/>
			</label>
			{#if form?.setupError}<p class="text-sm text-curtain" role="alert">{form.setupError}</p>{/if}
			<button disabled={pending} class="btn">Create owner account</button>
		</form>

		{#if data.seerrEnabled}<hr class="my-8 border-line" />{/if}
	{/if}

	{#if !data.needsSetup || data.seerrEnabled}
		<h1 class="font-display text-4xl tracking-wide">Sign in</h1>
		<p class="mt-2 text-sm text-muted">
			Use your Seerr / Jellyfin login, or the account you made from an invite link.
		</p>

		<form method="POST" action="?/login" use:enhance={submit} class="mt-6 space-y-4">
			<input type="hidden" name="redirectTo" value={redirectTo} />
			<label class="block">
				<span class="text-sm text-muted">Username or email</span>
				<input
					name="username"
					required
					autocomplete="username"
					value={form?.username ?? ''}
					class="field"
				/>
			</label>
			<label class="block">
				<span class="text-sm text-muted">Password</span>
				<input
					name="password"
					type="password"
					required
					autocomplete="current-password"
					class="field"
				/>
			</label>
			{#if form?.error}<p class="text-sm text-curtain" role="alert">{form.error}</p>{/if}
			<button disabled={pending} class="btn">{pending ? 'Signing in…' : 'Sign in'}</button>
		</form>
	{/if}
</div>
