<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	let { date, style = 'datetime' }: { date: Date; style?: 'datetime' | 'date' } = $props();

	const OPTIONS = {
		datetime: {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: 'numeric',
			minute: '2-digit'
		},
		date: { weekday: 'long', day: 'numeric', month: 'long' }
	} as const;

	// The server renders in its own time zone (so hydration matches); switch to the viewer's once mounted.
	let zone = $state<string | undefined>(page.data.serverTimeZone);
	onMount(() => (zone = undefined));
	const text = $derived(date.toLocaleString('en-AU', { ...OPTIONS[style], timeZone: zone }));
</script>

<time datetime={date.toISOString()}>{text}</time>
