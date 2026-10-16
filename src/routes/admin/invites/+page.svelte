<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let copied = $state<string | null>(null);

	const link = (code: string) => `${page.url.origin}/invite/${code}`;
	const now = Date.now();

	async function copy(code: string) {
		await navigator.clipboard.writeText(link(code));
		copied = code;
		setTimeout(() => (copied = null), 2000);
	}

	const status = (i: (typeof data.invites)[number]) =>
		i.usedAt
			? `Used by ${i.usedBy ?? 'a deleted user'}`
			: i.expiresAt.getTime() < now
				? 'Expired'
				: 'Open';
</script>

<svelte:head><title>Invites · Votarr</title></svelte:head>

<div class="flex items-center justify-between gap-4">
	<h2 class="font-display text-2xl tracking-wide">Invite links</h2>
	<form method="POST" action="?/create" use:enhance>
		<button class="btn w-auto px-4">New invite link</button>
	</form>
</div>
<p class="mt-2 text-sm text-muted">
	Each link works once and expires after 7 days. Friends with a Seerr account don't need one: they
	can sign in directly.
</p>

{#if form?.created}
	<div class="mt-4 rounded-xl border border-marquee/40 bg-panel p-4">
		<p class="text-sm text-muted">New link. Send it to a friend:</p>
		<div class="mt-2 flex flex-wrap items-center gap-2">
			<code class="min-w-0 flex-1 truncate rounded bg-screen px-2 py-1 text-sm"
				>{link(form.created)}</code
			>
			<button
				type="button"
				onclick={() => copy(form.created)}
				class="text-sm text-marquee underline"
			>
				{copied === form.created ? 'Copied!' : 'Copy'}
			</button>
		</div>
	</div>
{/if}

<ul class="mt-6 divide-y divide-line rounded-xl border border-line bg-panel">
	{#each data.invites as invite (invite.code)}
		{@const open = status(invite) === 'Open'}
		<li class="flex flex-wrap items-center gap-3 p-4 text-sm">
			<code class="text-muted">…{invite.code.slice(-6)}</code>
			<span class={open ? 'text-marquee' : 'text-muted'}>{status(invite)}</span>
			<span class="text-muted">expires {invite.expiresAt.toLocaleDateString()}</span>
			{#if open}
				<span class="ml-auto flex gap-4">
					<button type="button" onclick={() => copy(invite.code)} class="text-marquee underline">
						{copied === invite.code ? 'Copied!' : 'Copy link'}
					</button>
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="code" value={invite.code} />
						<button class="text-curtain underline">Revoke</button>
					</form>
				</span>
			{/if}
		</li>
	{:else}
		<li class="p-4 text-sm text-muted">No invites yet.</li>
	{/each}
</ul>
