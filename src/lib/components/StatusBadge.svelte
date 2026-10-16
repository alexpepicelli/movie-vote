<script lang="ts">
	import { displayStatus, type StatusInput } from '#lib/status.js';

	let { status, compact = false }: { status: StatusInput; compact?: boolean } = $props();
	const s = $derived(displayStatus(status));
	// Poster cards are narrow: shorten the download label to just the percentage.
	const text = $derived(compact && s.kind === 'downloading' ? `${s.progress}%` : s.label);

	const STYLES = {
		available: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
		downloading: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
		requested: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
		none: 'bg-white/5 text-muted ring-white/10'
	} as const;
	const DOTS = {
		available: 'bg-emerald-400',
		downloading: 'bg-sky-400 animate-pulse',
		requested: 'bg-amber-400',
		none: 'bg-muted/60'
	} as const;
</script>

{#if !(compact && s.kind === 'none')}
	<span
		class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 {STYLES[
			s.kind
		]}"
		title={s.label}
	>
		<span class="size-1.5 rounded-full {DOTS[s.kind]}" aria-hidden="true"></span>
		{text}
	</span>
{/if}
