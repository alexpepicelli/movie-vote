<script lang="ts">
	let {
		title,
		href,
		linkText = 'See all',
		level = 2,
		children
	}: {
		title: string;
		href?: string;
		linkText?: string;
		level?: 1 | 2;
		/** Extra content on the right, instead of (or as well as) the link. */
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class="flex items-end justify-between gap-3">
	<svelte:element
		this={level === 1 ? 'h1' : 'h2'}
		class="font-display {level === 1 ? 'text-3xl sm:text-4xl' : 'text-2xl'} leading-none"
		>{title}</svelte:element
	>
	<div class="flex shrink-0 items-center gap-3 text-sm">
		{@render children?.()}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved paths -->
		{#if href}<a {href} class="link">{linkText}</a>{/if}
	</div>
</div>
