<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';

	let {
		tmdbId,
		added,
		variant = 'full'
	}: { tmdbId: number; added: boolean; variant?: 'full' | 'icon' } = $props();

	// Optimistic: flip immediately, then let the server's reload confirm it.
	let optimistic = $state<boolean | null>(null);
	let pending = $state(false);
	let failed = $state(false);
	const on = $derived(optimistic ?? added);
	const label = $derived(on ? 'Remove from watchlist' : 'Add to watchlist');
</script>

<form
	method="POST"
	action="{resolve('/watchlist')}?/{on ? 'remove' : 'add'}"
	use:enhance={() => {
		const next = !on;
		optimistic = next;
		pending = true;
		failed = false;
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') failed = true;
			// navigate: false keeps us on this page (the action lives on /watchlist).
			await update({ reset: false, refreshAll: true, navigate: false });
			optimistic = null;
			pending = false;
		};
	}}
>
	<input type="hidden" name="tmdbId" value={tmdbId} />
	{#if variant === 'icon'}
		<button
			aria-label={label}
			aria-pressed={on}
			title={label}
			disabled={pending}
			class="grid size-11 place-items-center rounded-full shadow-lg ring-1 backdrop-blur-sm transition enabled:active:scale-90 disabled:opacity-50 {on
				? 'bg-accent text-on-accent ring-accent'
				: 'bg-screen/85 text-ink ring-white/20 enabled:hover:ring-accent'}"
		>
			<Icon name={on ? 'check' : 'plus'} size={18} stroke={2.6} />
		</button>
	{:else}
		<button
			aria-pressed={on}
			disabled={pending}
			class={on ? 'btn-ghost border-accent text-accent' : 'btn w-auto'}
		>
			<Icon name={on ? 'check' : 'plus'} size={18} stroke={2.6} />
			{on ? 'On your watchlist' : 'Add to watchlist'}
		</button>
	{/if}
	{#if failed}
		<span class={variant === 'icon' ? 'sr-only' : 'mt-1 block text-xs text-danger'} role="alert">
			Couldn't update your watchlist. Try again.
		</span>
	{/if}
</form>
