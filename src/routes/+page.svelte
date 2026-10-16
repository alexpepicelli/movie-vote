<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<section class="rounded-2xl border border-line bg-panel p-6">
	<h1 class="font-display text-4xl tracking-wide">Hey {data.user?.displayName} 👋</h1>
	<p class="mt-2 text-muted">No movie night yet. Watchlists and voting are on the way.</p>
	{#if data.user?.role === 'owner'}
		<a href={resolve('/healthz?deep')} class="mt-4 inline-block text-sm text-marquee underline">
			Check connections to Seerr and Radarr
		</a>
	{/if}
</section>
