<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';

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
		{ href: resolve('/'), label: 'Tonight', icon: 'home' as const },
		{ href: resolve('/discover'), label: 'Discover', icon: 'search' as const },
		{ href: resolve('/watchlist'), label: 'Watchlist', icon: 'bookmark' as const },
		{ href: resolve('/nights'), label: 'Nights', icon: 'calendar' as const },
		...(data.user?.role === 'owner'
			? [{ href: resolve('/admin/settings'), label: 'Admin', icon: 'settings' as const }]
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
	<meta name="theme-color" content="#0d0b1e" />
	<title>Votarr</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Kanit:ital,wght@1,700;1,800&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
	<header class="flex items-center justify-between gap-4 py-4">
		<a href={resolve('/')} class="font-display text-2xl leading-none text-sunset">VOTARR</a>

		{#if data.user}
			<nav class="hidden items-center gap-1 text-sm sm:flex" aria-label="Main">
				{#each links as link (link.href)}
					{@const active = isActive(link.href)}
					<a
						href={link.href}
						aria-current={active ? 'page' : undefined}
						class="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold transition {active
							? 'bg-panel text-ink'
							: 'text-muted hover:text-ink'}"
					>
						<Icon name={link.icon} size={18} class={active ? 'text-accent' : ''} />
						<span class="hidden md:inline">{link.label}</span>
					</a>
				{/each}
			</nav>

			<div class="flex items-center gap-2 text-sm whitespace-nowrap">
				<Avatar id={data.user.id} name={data.user.displayName} size={32} />
				<span class="hidden font-semibold lg:inline">{data.user.displayName}</span>
				<form method="POST" action={resolve('/logout')}>
					<button
						aria-label="Sign out"
						title="Sign out"
						class="grid size-10 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-ink"
					>
						<Icon name="logout" size={18} />
					</button>
				</form>
			</div>
		{/if}
	</header>

	<main class="flex-1 pt-2 pb-8 {data.user ? 'pb-28 sm:pb-12' : ''}">
		{@render children()}
	</main>
</div>

{#if data.user}
	<nav
		aria-label="Main"
		class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-screen/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
	>
		<ul class="mx-auto flex max-w-md justify-around">
			{#each links as link (link.href)}
				{@const active = isActive(link.href)}
				<li>
					<a
						href={link.href}
						aria-current={active ? 'page' : undefined}
						class="flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 px-2 text-[11px] font-semibold {active
							? 'text-accent'
							: 'text-muted'}"
					>
						<Icon name={link.icon} size={22} />
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
