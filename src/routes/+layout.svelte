<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';

	let { children, data }: LayoutProps = $props();

	// Live updates: when a night changes, reload the pages that show nights. Debounced so a
	// burst of votes is one reload; after a reconnect, reload too in case we missed something.
	const signedIn = $derived(!!data.user);
	$effect(() => {
		if (!signedIn) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const refresh = () => {
			clearTimeout(timer);
			timer = setTimeout(() => invalidate('votarr:nights'), 300);
		};
		let opened = false;
		const source = new EventSource(resolve('/events'));
		source.addEventListener('night', refresh);
		source.addEventListener('open', () => {
			if (opened) refresh();
			opened = true;
		});
		return () => {
			clearTimeout(timer);
			source.close();
		};
	});

	const links = $derived([
		{ href: resolve('/'), label: 'Home', icon: '🏠' },
		{ href: resolve('/discover'), label: 'Discover', icon: '🔎' },
		{ href: resolve('/watchlist'), label: 'Watchlist', icon: '🍿' },
		{ href: resolve('/nights'), label: 'Nights', icon: '🎟️' },
		...(data.user?.role === 'owner'
			? [{ href: resolve('/admin/settings'), label: 'Admin', icon: '⚙️' }]
			: [])
	]);

	const isActive = (href: string) =>
		href === '/'
			? page.url.pathname === '/'
			: href.startsWith('/admin')
				? page.url.pathname.startsWith('/admin')
				: page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Installable from the home screen (no service worker: Votarr needs the server anyway). -->
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black" />
	<meta name="apple-mobile-web-app-title" content="Votarr" />
	<meta name="theme-color" content="#15151c" />
	<title>Votarr</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-5xl flex-col px-4">
	<header class="flex items-center justify-between gap-4 border-b border-line py-4">
		<a
			href={resolve('/')}
			class="font-display text-xl tracking-wide whitespace-nowrap text-marquee sm:text-2xl"
			>🎬 Votarr</a
		>

		{#if data.user}
			<nav class="hidden items-center gap-5 text-sm sm:flex" aria-label="Main">
				{#each links.slice(1) as link (link.href)}
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class={isActive(link.href) ? 'text-ink' : 'text-muted hover:text-ink'}>{link.label}</a
					>
				{/each}
			</nav>

			<div class="flex items-center gap-3 text-sm whitespace-nowrap">
				<span class="flex items-center gap-2">
					<span
						class="grid size-7 place-items-center rounded-full bg-curtain text-xs font-semibold uppercase"
						aria-hidden="true">{data.user.displayName.slice(0, 1)}</span
					>
					<span class="hidden md:inline">{data.user.displayName}</span>
				</span>
				<form method="POST" action={resolve('/logout')}>
					<button class="text-muted hover:text-ink">Sign out</button>
				</form>
			</div>
		{/if}
	</header>

	<main class="flex-1 py-6 {data.user ? 'pb-24 sm:pb-6' : ''}">
		{@render children()}
	</main>
</div>

{#if data.user}
	<nav
		aria-label="Main"
		class="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-screen/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
	>
		<ul class="mx-auto flex max-w-md justify-around">
			{#each links as link (link.href)}
				<li>
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class="flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] {isActive(link.href)
							? 'text-marquee'
							: 'text-muted'}"
					>
						<span class="text-lg leading-none" aria-hidden="true">{link.icon}</span>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
