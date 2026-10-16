<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

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
			class="grid size-9 place-items-center rounded-full text-lg shadow-lg ring-1 backdrop-blur-sm transition active:scale-90 {on
				? 'bg-marquee text-screen ring-marquee'
				: 'bg-screen/85 text-ink ring-white/20 hover:ring-marquee'}"
		>
			{on ? '✓' : '+'}
		</button>
	{:else}
		<button
			aria-pressed={on}
			disabled={pending}
			class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition {on
				? 'border border-marquee text-marquee hover:bg-marquee/10'
				: 'bg-marquee text-screen hover:brightness-110'}"
		>
			{on ? '✓ On your watchlist' : '+ Add to watchlist'}
		</button>
	{/if}
	{#if failed}
		<span class={variant === 'icon' ? 'sr-only' : 'mt-1 block text-xs text-curtain'} role="alert">
			Couldn't update your watchlist. Try again.
		</span>
	{/if}
</form>
