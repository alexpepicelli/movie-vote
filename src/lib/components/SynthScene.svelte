<script lang="ts">
	import RetroGrid from './RetroGrid.svelte';

	// The 80s horizon behind a hero card: stars, a striped sun setting into a glowing horizon,
	// and the drifting grid floor. It hugs the top of the card and fades out below.
	let { class: className = '' }: { class?: string } = $props();

	let floor = $state(0);
</script>

<div
	class="synth-scene pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden {className}"
	aria-hidden="true"
>
	<div class="synth-stars"></div>
	<!-- Sun: only the part above the horizon shows. -->
	<div
		class="absolute right-[4%] h-24 w-32 overflow-hidden sm:right-[10%] sm:h-44 sm:w-56"
		style:bottom="{floor}px"
	>
		<div class="synth-sun aspect-square w-full"></div>
	</div>
	<div class="synth-horizon absolute inset-x-0" style:bottom="{floor}px"></div>
	<RetroGrid depth={260} tilt={40} bind:height={floor} class="opacity-80" />
</div>
