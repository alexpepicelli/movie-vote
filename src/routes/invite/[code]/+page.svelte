<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Join · Votarr</title></svelte:head>

<div class="card relative mx-auto mt-4 max-w-sm overflow-hidden p-6 sm:mt-10 sm:p-8">
	<div class="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden" aria-hidden="true">
		<div class="retro-sun -top-8 right-6 size-32 opacity-25"></div>
		<div class="retro-grid h-16 opacity-60"></div>
	</div>
	<div class="relative pt-16">
		{#if data.state === 'valid'}
			<h1 class="font-display text-4xl text-sunset">You're invited</h1>
			<p class="mt-2 text-sm text-muted">Make an account to add films and vote on movie night.</p>

			<form
				method="POST"
				use:enhance={() => {
					pending = true;
					return async ({ update }) => {
						await update();
						pending = false;
					};
				}}
				class="mt-6 space-y-4"
			>
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
					<span class="text-sm text-muted">Display name (what friends see)</span>
					<input name="displayName" required value={form?.displayName ?? ''} class="field" />
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
				{#if form?.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
				<button disabled={pending} class="btn">{pending ? 'Creating…' : 'Create account'}</button>
			</form>
		{:else}
			<h1 class="font-display text-4xl text-sunset">Invite unavailable</h1>
			<p class="mt-2 text-muted">
				{data.state === 'used'
					? 'This invite has already been used.'
					: data.state === 'expired'
						? 'This invite has expired. Ask for a new one.'
						: "This invite link isn't valid."}
			</p>
			<a href={resolve('/login')} class="link mt-4 inline-block text-sm">Go to sign in</a>
		{/if}
	</div>
</div>
