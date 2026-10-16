<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Avatar from './Avatar.svelte';

	type Person = {
		id: string;
		displayName: string;
		hasAvatar: boolean;
		me: boolean;
		going: boolean;
		joined: boolean;
		nominated: boolean;
		/** Null when it's someone else's vote on a secret ballot. */
		voted: boolean | null;
	};
	let { people, nightId, canJoin }: { people: Person[]; nightId: string; canJoin: boolean } =
		$props();

	const going = $derived(people.filter((p) => p.going));
	const notYet = $derived(people.filter((p) => !p.going));
	const me = $derived(people.find((p) => p.me));
	// "I'm in" can only be taken back while it's the only thing you've done.
	const canLeave = $derived(!!me?.joined && !me.nominated && !me.voted);
	let pending = $state(false);
	let error = $state('');

	const did = (p: Person) =>
		[p.nominated && 'picked', p.voted && 'voted'].filter(Boolean).join(' · ') || 'in';
</script>

<section class="card flex flex-col gap-4 p-4" aria-label="Who's in">
	<div class="flex items-center justify-between gap-3">
		<h2 class="font-display text-xl leading-none">Who's in</h2>
		<span class="font-mono text-xs text-muted">{going.length} going</span>
	</div>

	{#if going.length}
		<ul class="flex flex-wrap gap-x-4 gap-y-3">
			{#each going as p (p.id)}
				<li class="flex w-16 flex-col items-center gap-1 text-center">
					<span
						class="rounded-full p-0.5 {p.voted
							? 'bg-gradient-to-br from-sunset to-accent'
							: 'bg-line'}"
					>
						<Avatar
							id={p.id}
							name={p.displayName}
							hasAvatar={p.hasAvatar}
							size={40}
							class="ring-2 ring-panel"
						/>
					</span>
					<span class="w-full truncate text-xs font-semibold">{p.me ? 'You' : p.displayName}</span>
					<span class="-mt-1 text-[10px] text-muted">{did(p)}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted">Nobody yet. Be the first.</p>
	{/if}

	{#if notYet.length}
		<div class="flex items-center gap-3 border-t border-line pt-3">
			<span class="text-xs text-muted">Not in yet</span>
			<span class="flex flex-wrap gap-1.5 opacity-60">
				{#each notYet as p (p.id)}
					<Avatar id={p.id} name={p.me ? 'You' : p.displayName} hasAvatar={p.hasAvatar} size={24} />
				{/each}
			</span>
		</div>
	{/if}

	{#if canJoin && me && (!me.going || canLeave)}
		<form
			method="POST"
			action="{resolve('/nights/[id]', { id: nightId })}?/{me.going ? 'unattend' : 'attend'}"
			use:enhance={() => {
				pending = true;
				error = '';
				return async ({ update, result }) => {
					try {
						if (result.type === 'failure')
							error = String(result.data?.error ?? 'Could not update attendance. Try again.');
						if (result.type === 'error') error = 'Could not update attendance. Try again.';
						await update({ reset: false, navigate: false });
					} finally {
						pending = false;
					}
				};
			}}
		>
			{#if me.going}
				<button disabled={pending} class="btn-ghost w-full text-sm"
					>I can't make it after all</button
				>
			{:else}
				<button disabled={pending} class="btn">I'm in</button>
			{/if}
		</form>
		{#if error}<p class="text-sm text-danger" role="alert">{error}</p>{/if}
	{/if}
</section>
