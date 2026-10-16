<script lang="ts">
	let {
		label,
		live = false,
		children
	}: { label: string; live?: boolean; children: import('svelte').Snippet } = $props();
</script>

<div class="rounded-xl border border-line bg-screen/70 px-3 py-2.5">
	<div class="font-mono text-[11px] tracking-wider text-muted uppercase">{label}</div>
	<div
		class="mt-1 font-mono text-xl font-bold tabular-nums sm:text-2xl {live
			? 'text-live [text-shadow:0_0_12px_rgba(69,227,255,0.45)]'
			: ''}"
	>
		{@render children()}
	</div>
</div>
