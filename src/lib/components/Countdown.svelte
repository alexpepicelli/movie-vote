<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshAll } from '$app/navigation';

	let { to }: { to: Date } = $props();
	let now = $state(Date.now());

	onMount(() => {
		let refreshed = false;
		const timer = setInterval(() => {
			now = Date.now();
			// The server moves the night on at the deadline; pull the new phase in.
			if (!refreshed && now >= to.getTime() + 2000) {
				refreshed = true;
				void refreshAll();
			}
		}, 1000);
		return () => clearInterval(timer);
	});

	const text = $derived.by(() => {
		const ms = to.getTime() - now;
		if (ms <= 0) return 'any moment now';
		const m = Math.floor(ms / 60_000);
		const d = Math.floor(m / 1440);
		const h = Math.floor((m % 1440) / 60);
		if (d > 0) return `in ${d}d ${h}h`;
		if (h > 0) return `in ${h}h ${m % 60}m`;
		if (m > 0) return `in ${m}m`;
		return `in ${Math.ceil(ms / 1000)}s`;
	});
</script>

<span class="tabular-nums">{text}</span>
