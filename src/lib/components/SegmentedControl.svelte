<script lang="ts">
	type Item = { label: string; active: boolean; onclick: () => void };
	let { items, label }: { items: Item[]; label: string } = $props();
</script>

<div
	role="group"
	aria-label={label}
	class="grid rounded-xl bg-panel p-1"
	style="grid-template-columns: repeat({items.length}, minmax(0, 1fr))"
>
	{#each items as item (item.label)}
		<button
			type="button"
			aria-pressed={item.active}
			onclick={item.onclick}
			class="flex min-h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition {item.active
				? 'bg-line text-ink'
				: 'text-muted enabled:hover:text-ink'}">{item.label}</button
		>
	{/each}
</div>
