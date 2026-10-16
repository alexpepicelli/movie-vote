<script lang="ts">
	import { onMount } from 'svelte';

	let {
		storageKey,
		posters,
		count,
		children
	}: {
		/** localStorage key remembering that this viewer has seen the reveal. */
		storageKey: string;
		/** Nominee poster URLs to cycle through during the drumroll; the winner's first. */
		posters: string[];
		count: number;
		children: import('svelte').Snippet;
	} = $props();

	let stage = $state<'hidden' | 'drumroll' | 'shown'>('hidden');
	let index = $state(0);
	let confetti = $state(false);

	onMount(() => {
		try {
			if (localStorage.getItem(storageKey)) stage = 'shown';
		} catch {
			// storage blocked: just show the reveal button
		}
	});

	function remember() {
		try {
			localStorage.setItem(storageKey, '1');
		} catch {
			// not essential
		}
	}

	function reveal() {
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced || posters.length < 2) return finish(!reduced);

		stage = 'drumroll';
		// Spin through the nominees, slowing down, then land.
		let delay = 70;
		const step = () => {
			index = (index + 1) % posters.length;
			delay *= 1.15;
			if (delay < 420) setTimeout(step, delay);
			else {
				index = 0; // posters[0] is the winner: land on it
				setTimeout(() => finish(true), 900);
			}
		};
		setTimeout(step, delay);
	}

	function finish(celebrate: boolean) {
		stage = 'shown';
		remember();
		if (celebrate) {
			confetti = true;
			setTimeout(() => (confetti = false), 3500);
		}
	}

	const COLORS = ['#f5c542', '#e5484d', '#3ecf8e', '#4aa3ff', '#ffffff'];
	const pieces = Array.from({ length: 48 }, (_, i) => ({
		left: (i * 37) % 100,
		delay: ((i * 53) % 100) / 100,
		duration: 2.2 + ((i * 29) % 10) / 10,
		color: COLORS[i % COLORS.length],
		rotate: (i * 47) % 360
	}));
</script>

{#if stage === 'shown'}
	<div class="relative">
		{@render children()}
		{#if confetti}
			<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
				{#each pieces as p, i (i)}
					<span
						class="confetti absolute top-0 block h-3 w-2 rounded-sm"
						style="left: {p.left}%; background: {p.color}; animation-delay: {p.delay}s; animation-duration: {p.duration}s; --r: {p.rotate}deg"
					></span>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<section
		class="mt-8 grid place-items-center gap-5 rounded-2xl border border-marquee/40 bg-gradient-to-br from-marquee/10 to-transparent p-8 text-center"
		aria-live="polite"
	>
		{#if stage === 'drumroll'}
			<p class="text-xs tracking-widest text-marquee uppercase">🥁 And the winner is…</p>
			<img
				src={posters[index]}
				alt=""
				class="w-40 rounded-xl shadow-2xl ring-1 ring-marquee/50 sm:w-48"
			/>
		{:else}
			<p class="text-xs tracking-widest text-marquee uppercase">The votes are in</p>
			<p class="font-display text-3xl tracking-wide">
				{count} film{count === 1 ? '' : 's'} nominated. One winner.
			</p>
			<button onclick={reveal} class="btn w-auto px-6 py-3 text-base">🎬 Reveal the winner</button>
		{/if}
	</section>
{/if}

<style>
	.confetti {
		animation-name: fall;
		animation-timing-function: cubic-bezier(0.3, 0.6, 0.6, 1);
		animation-fill-mode: forwards;
		transform: translateY(-20px) rotate(var(--r));
	}
	@keyframes fall {
		to {
			transform: translateY(700px) rotate(calc(var(--r) + 540deg));
			opacity: 0;
		}
	}
</style>
