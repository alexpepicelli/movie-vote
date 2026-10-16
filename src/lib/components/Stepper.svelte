<script lang="ts">
	type Status = 'draft' | 'nominating' | 'voting' | 'closed' | 'watched';
	let { status }: { status: Status } = $props();

	const STEPS = ['Nominate', 'Vote', 'Watch'] as const;
	// Which step is underway, and whether it's done.
	const current = $derived(
		status === 'draft' || status === 'nominating'
			? 0
			: status === 'voting'
				? 1
				: status === 'closed'
					? 2
					: 3
	);
</script>

<ol aria-label="Progress" class="grid grid-cols-3 gap-1.5">
	{#each STEPS as label, i (label)}
		{@const done = i < current}
		{@const active = i === current}
		<li aria-current={active ? 'step' : undefined} class="flex flex-col gap-1.5">
			<span class="h-1 overflow-hidden rounded-full bg-line">
				<span
					class="block h-full rounded-full bg-gradient-to-r from-sunset to-accent transition-[width] duration-700"
					style="width: {done ? 100 : active ? 55 : 0}%"
				></span>
			</span>
			<span class="text-xs {active ? 'font-bold text-ink' : done ? 'text-ink/80' : 'text-muted'}"
				>{label}</span
			>
		</li>
	{/each}
</ol>
