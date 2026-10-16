<script lang="ts">
	let {
		id,
		name,
		size = 32,
		class: className = ''
	}: { id: string; name: string; size?: number; class?: string } = $props();

	// A stable colour per person, picked from hues that read well on the dark ground.
	const HUES = [330, 20, 45, 190, 260, 150, 290, 0];
	const hue = $derived(
		HUES[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length]
	);
	const initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase() || '?'
	);
</script>

<span
	class="inline-grid shrink-0 place-items-center rounded-full font-bold text-white select-none {className}"
	style="width: {size}px; height: {size}px; font-size: {Math.round(
		size * 0.4
	)}px; background: oklch(0.5 0.14 {hue})"
	title={name}
	aria-hidden="true">{initials}</span
>
