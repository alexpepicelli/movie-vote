<script lang="ts">
	import Avatar from './Avatar.svelte';

	type Person = { id: string; displayName: string; hasAvatar: boolean; value?: number };
	let {
		people,
		max = 5,
		size = 26,
		label
	}: {
		/** With `value`, each face gets a ▲ or ▼ badge. */
		people: Person[];
		max?: number;
		size?: number;
		/** What the list is, for screen readers, e.g. "Votes on Heat". */
		label: string;
	} = $props();

	const shown = $derived(people.slice(0, max));
	const extra = $derived(people.length - shown.length);
	const describe = (p: Person) =>
		p.value === undefined ? p.displayName : `${p.displayName} ${p.value > 0 ? '▲' : '▼'}`;
</script>

{#if people.length}
	<details class="group relative">
		<summary
			class="flex min-h-11 min-w-11 cursor-pointer list-none items-center rounded-full [&::-webkit-details-marker]:hidden"
			aria-label="{label}: {people.map(describe).join(', ')}"
		>
			{#each shown as p, i (p.id)}
				<span class="relative rounded-full ring-2 ring-panel" style="margin-left: {i ? -8 : 0}px">
					<Avatar id={p.id} name={p.displayName} hasAvatar={p.hasAvatar} {size} />
					{#if p.value !== undefined}
						<span
							class="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full text-[8px] leading-none font-black ring-2 ring-panel {p.value >
							0
								? 'bg-accent text-on-accent'
								: 'bg-sunset text-on-accent'}">{p.value > 0 ? '▲' : '▼'}</span
						>
					{/if}
				</span>
			{/each}
			{#if extra > 0}
				<span
					class="-ml-2 grid place-items-center rounded-full bg-line font-mono text-[10px] font-bold ring-2 ring-panel"
					style="width: {size}px; height: {size}px">+{extra}</span
				>
			{/if}
		</summary>
		<ul class="mt-2 flex max-w-full flex-col gap-2 rounded-lg bg-raised p-2 text-xs">
			{#each people as p (p.id)}
				<li class="flex items-center gap-2">
					<Avatar id={p.id} name={p.displayName} hasAvatar={p.hasAvatar} size={22} />
					<span class="min-w-0 flex-1 break-words">{p.displayName}</span>
					{#if p.value !== undefined}
						<span class="font-mono font-bold {p.value > 0 ? 'text-accent' : 'text-sunset'}"
							>{p.value > 0 ? '▲' : '▼'}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	</details>
{/if}
