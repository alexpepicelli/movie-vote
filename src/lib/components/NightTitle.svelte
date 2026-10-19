<script lang="ts">
	// The night's name as a pink neon script with its status tucked under it in yellow caps.
	// Long names step down a size so they stay on a line or two.
	let { title, label }: { title: string; label: string } = $props();

	const size = $derived(
		title.length <= 14
			? 'text-6xl sm:text-7xl'
			: title.length <= 24
				? 'text-5xl sm:text-6xl'
				: 'text-4xl sm:text-5xl'
	);
</script>

<div>
	<h1 class="neon-script text-balance {size}">{title}</h1>
	<p class="neon-caps">{label}</p>
</div>
