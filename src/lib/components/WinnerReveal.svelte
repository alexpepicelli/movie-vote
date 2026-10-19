<script lang="ts">
	import RetroGrid from './RetroGrid.svelte';
	import { onMount } from 'svelte';

	let {
		storageKey,
		title,
		count,
		children
	}: {
		/** localStorage key remembering that this viewer has seen the reveal. */
		storageKey: string;
		/** The winning film's title, for the title card. */
		title: string;
		count: number;
		children: import('svelte').Snippet;
	} = $props();

	let stage = $state<'hidden' | 'playing' | 'shown'>('hidden');
	let fresh = $state(false); // shown just now (animate the results in) vs seen before

	onMount(() => {
		try {
			if (localStorage.getItem(storageKey)) stage = 'shown';
		} catch {
			// storage blocked: just show the reveal button
		}
	});

	function reveal() {
		try {
			localStorage.setItem(storageKey, '1');
		} catch {
			// not essential
		}
		fresh = true;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			stage = 'shown';
			return;
		}
		// Sun rises, title slides in and shines, then the full results.
		stage = 'playing';
		setTimeout(() => (stage = 'shown'), 3200);
	}
</script>

{#if stage === 'shown'}
	<div class="flex flex-col gap-8 {fresh ? 'animate-rise' : ''}">
		{@render children()}
	</div>
{:else}
	<section
		class="relative grid min-h-[26rem] place-items-center overflow-hidden rounded-2xl border border-line bg-[#0a0818] p-6 text-center"
		aria-live="polite"
	>
		{#if stage === 'playing'}
			<div class="pointer-events-none absolute inset-0" aria-hidden="true">
				<div
					class="sun retro-sun bottom-28 left-1/2 size-56 -translate-x-1/2 opacity-60 [--sun-gap:#0a0818]"
				></div>
				<RetroGrid depth={144} />
			</div>
			<div class="relative flex flex-col items-center gap-3 self-start pt-6">
				<p class="eyebrow fade text-live [text-shadow:0_0_10px_rgba(69,227,255,0.6)]">
					Tonight's feature
				</p>
				<p class="title font-display text-5xl leading-[0.9] text-sunset sm:text-7xl">
					{title}
				</p>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-4">
				<p class="eyebrow text-muted">The votes are in</p>
				<p class="font-display text-4xl leading-none sm:text-5xl">Ready for the winner?</p>
				<p class="max-w-xs text-sm text-muted">
					{count} film{count === 1 ? '' : 's'} nominated, one winner. Best on the big screen.
				</p>
				<button onclick={reveal} class="btn mt-2 w-auto px-7">Reveal the winner</button>
			</div>
		{/if}
	</section>
{/if}

<style>
	.sun {
		animation: sun-rise 1.3s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	.fade {
		animation: fade 0.5s 0.3s ease-out both;
	}
	.title {
		animation:
			title-in 0.7s 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both,
			shine 1.6s 1.4s ease-in-out both;
		background-image:
			linear-gradient(100deg, transparent 40%, rgba(255, 255, 255, 0.95) 50%, transparent 60%),
			linear-gradient(
				180deg,
				#fff3d6 10%,
				var(--color-sunset) 52%,
				var(--color-accent) 54%,
				#c03dff 100%
			);
		background-size:
			250% 100%,
			100% 100%;
		background-repeat: no-repeat;
		filter: drop-shadow(0 4px 0 #2a0f3a);
	}
	@keyframes sun-rise {
		from {
			transform: translateY(120px);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
	@keyframes title-in {
		from {
			opacity: 0;
			transform: translateX(-40px) skewX(-12deg);
		}
	}
	@keyframes shine {
		from {
			background-position:
				-160% 0,
				0 0;
		}
		to {
			background-position:
				260% 0,
				0 0;
		}
	}
</style>
