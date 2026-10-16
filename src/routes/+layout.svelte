<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { resolve } from '$app/paths';

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#1a1a22" />
	<title>Movie Vote</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-5xl flex-col px-4">
	<header class="flex items-center justify-between gap-4 border-b border-line py-4">
		<a href={resolve('/')} class="font-display text-2xl tracking-wide text-marquee">🎬 Movie Vote</a
		>

		{#if data.user}
			<nav class="flex items-center gap-4 text-sm">
				{#if data.user.role === 'owner'}
					<a href={resolve('/admin/invites')} class="text-muted hover:text-ink">Invites</a>
				{/if}
				<span class="flex items-center gap-2">
					<span
						class="grid size-7 place-items-center rounded-full bg-curtain text-xs font-semibold uppercase"
						aria-hidden="true">{data.user.displayName.slice(0, 1)}</span
					>
					<span class="hidden sm:inline">{data.user.displayName}</span>
				</span>
				<form method="POST" action={resolve('/logout')}>
					<button class="text-muted hover:text-ink">Sign out</button>
				</form>
			</nav>
		{/if}
	</header>

	<main class="flex-1 py-6">
		{@render children()}
	</main>
</div>
