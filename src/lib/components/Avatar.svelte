<script lang="ts">
	let {
		id,
		name,
		hasAvatar = false,
		size = 32,
		class: className = ''
	}: {
		id: string;
		name: string;
		/** True when the person has a Seerr/Jellyfin picture (served from /avatar/[id]). */
		hasAvatar?: boolean;
		size?: number;
		class?: string;
	} = $props();

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
	let failed = $state(false);
</script>

<span
	class="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white select-none {className}"
	style="width: {size}px; height: {size}px; font-size: {Math.round(
		size * 0.4
	)}px; background: oklch(0.5 0.14 {hue})"
	title={name}
	aria-hidden="true"
>
	{initials}
	{#if hasAvatar && !failed}
		<img
			src="/avatar/{id}"
			alt=""
			loading="lazy"
			onerror={() => (failed = true)}
			class="absolute inset-0 size-full object-cover"
		/>
	{/if}
</span>
