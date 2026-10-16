<script lang="ts">
	import { displayStatus, type StatusInput } from '#lib/status.js';

	let { status, compact = false }: { status: StatusInput; compact?: boolean } = $props();
	const s = $derived(displayStatus(status));
	// Poster cards are narrow: shorten the download label to just the percentage.
	const text = $derived(compact && s.kind === 'downloading' ? `${s.progress}%` : s.label);

	const STYLES = {
		available: 'text-live',
		downloading: 'text-sunset'
	} as const;
	const DOTS = {
		available: 'bg-live shadow-[0_0_8px_var(--color-live)]',
		downloading: 'bg-sunset animate-pulse'
	} as const;
</script>

{#if s.kind === 'available' || s.kind === 'downloading'}
	<span
		class="inline-flex items-center gap-1.5 rounded-full bg-screen/80 px-2 py-0.5 text-xs font-semibold whitespace-nowrap {STYLES[
			s.kind
		]}"
		title={s.label}
	>
		<span class="size-1.5 rounded-full {DOTS[s.kind]}" aria-hidden="true"></span>
		{text}
	</span>
{/if}
