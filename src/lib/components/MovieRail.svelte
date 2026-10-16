<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	let { title, description, children }: { title: string; description?: string; children: Snippet } =
		$props();
	let rail: HTMLDivElement;
	let atStart = $state(true);
	let atEnd = $state(true);
	function measure() {
		if (!rail) return;
		atStart = rail.scrollLeft < 2;
		atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
	}
	function move(direction: number) {
		rail.scrollBy({
			left: direction * rail.clientWidth * 0.85,
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
		});
	}
	onMount(() => {
		const observer = new ResizeObserver(measure);
		observer.observe(rail);
		const contents = new MutationObserver(measure);
		contents.observe(rail, { childList: true });
		measure();
		return () => {
			observer.disconnect();
			contents.disconnect();
		};
	});
</script>

<section class="min-w-0" aria-label={title}>
	<div class="mb-4 flex items-end justify-between gap-4">
		<div>
			<h2 class="font-display text-2xl sm:text-3xl">{title}</h2>
			{#if description}<p class="mt-1 text-sm text-muted">{description}</p>{/if}
		</div>
		<div class="flex shrink-0 gap-2">
			<button
				type="button"
				class="btn-ghost size-11 p-0 disabled:opacity-25"
				disabled={atStart}
				aria-label="Previous movies in {title}"
				onclick={() => move(-1)}
				><span class="rotate-180"><Icon name="forward" size={18} /></span></button
			>
			<button
				type="button"
				class="btn-ghost size-11 p-0 disabled:opacity-25"
				disabled={atEnd}
				aria-label="Next movies in {title}"
				onclick={() => move(1)}><Icon name="forward" size={18} /></button
			>
		</div>
	</div>
	<div
		bind:this={rail}
		onscroll={measure}
		class="movie-rail flex snap-x snap-mandatory scroll-px-1 [scrollbar-width:thin] [scrollbar-color:var(--color-line)_transparent] gap-4 overflow-x-auto px-1 pt-2 pb-4 [&>*]:w-[42%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[23%] lg:[&>*]:w-[18%]"
	>
		{@render children()}
	</div>
</section>
