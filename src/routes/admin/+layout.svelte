<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = [
		{ href: resolve('/admin/settings'), label: 'Settings' },
		{ href: resolve('/admin/invites'), label: 'Invites' },
		{ href: resolve('/admin/health'), label: 'Health' }
	];
</script>

<h1 class="font-display text-4xl tracking-wide">Admin</h1>
<nav class="mt-3 mb-6 flex gap-1 border-b border-line text-sm" aria-label="Admin">
	{#each tabs as tab (tab.href)}
		{@const active = page.url.pathname.startsWith(tab.href)}
		<a
			href={tab.href}
			aria-current={active ? 'page' : undefined}
			class="-mb-px border-b-2 px-3 py-2 {active
				? 'border-marquee text-ink'
				: 'border-transparent text-muted hover:text-ink'}">{tab.label}</a
		>
	{/each}
</nav>

{@render children()}
