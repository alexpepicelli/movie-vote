<script lang="ts">
	import { imageUrl } from '#lib/status.js';

	let {
		path,
		title,
		size = 'w342',
		class: className = '',
		children
	}: {
		path: string | null | undefined;
		/** Shown in place of the image when there's no poster (and as alt text when `alt` matters). */
		title: string;
		size?: 'w185' | 'w342' | 'w780';
		class?: string;
		/** Overlays, e.g. a status pill. */
		children?: import('svelte').Snippet;
	} = $props();

	const src = $derived(imageUrl(path, size));
	let failed = $state(false);
</script>

<div
	class="relative aspect-[2/3] overflow-hidden rounded-xl bg-raised ring-1 ring-white/5 {className}"
>
	{#if src && !failed}
		<img
			{src}
			alt=""
			loading="lazy"
			onerror={() => (failed = true)}
			class="size-full object-cover"
		/>
	{:else}
		<div class="flex size-full items-end p-3">
			<span class="font-display text-lg leading-none text-muted">{title}</span>
		</div>
	{/if}
	{@render children?.()}
</div>
