<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import Icon from './Icon.svelte';

	let {
		nominationId,
		title,
		myVote,
		score,
		canVote,
		ownPick,
		busy,
		submit
	}: {
		nominationId: string;
		title: string;
		/** This viewer's vote: 1, -1 or null. */
		myVote: number | null;
		/** The film's live score, or null when counts are hidden. */
		score: number | null;
		/** False when the viewer has no votes left (they can still change or clear an existing one). */
		canVote: boolean;
		ownPick: boolean;
		busy: boolean;
		submit: SubmitFunction;
	} = $props();

	const locked = $derived(busy || ownPick || (myVote === null && !canVote));
	// Tapping your current choice clears it; tapping the other one flips it.
	const action = (dir: 1 | -1) => (myVote === dir ? '?/unvote' : '?/vote');
	const label = (dir: 1 | -1) => {
		const word = dir === 1 ? 'Upvote' : 'Downvote';
		if (ownPick) return `You picked ${title}, so you can’t vote on it`;
		return myVote === dir ? `Remove your ${word.toLowerCase()} for ${title}` : `${word} ${title}`;
	};
	const scoreText = $derived(score === null ? null : score > 0 ? `+${score}` : String(score));
</script>

<form method="POST" use:enhance={submit} class="flex flex-col items-center gap-0.5 self-center">
	<input type="hidden" name="nominationId" value={nominationId} />
	<button
		name="value"
		value="up"
		formaction={action(1)}
		aria-pressed={myVote === 1}
		aria-label={label(1)}
		title={label(1)}
		disabled={locked}
		class="grid size-11 place-items-center rounded-xl transition active:scale-90 disabled:cursor-default disabled:opacity-35 {myVote ===
		1
			? 'bg-gradient-to-b from-[#ff8a4c] to-accent text-on-accent shadow-[0_0_14px_rgba(255,79,154,0.45)]'
			: 'border border-line text-ink hover:border-accent hover:text-accent'}"
	>
		<Icon name="up" size={22} stroke={2.8} />
	</button>
	<span
		class="min-h-5 font-mono text-sm font-bold tabular-nums {score === null
			? 'text-muted'
			: score > 0
				? 'text-accent'
				: score < 0
					? 'text-sunset'
					: 'text-muted'}"
		aria-label={scoreText === null ? undefined : `Score ${scoreText}`}
	>
		{scoreText ?? (ownPick ? 'Yours' : '·')}
	</span>
	<button
		name="value"
		value="down"
		formaction={action(-1)}
		aria-pressed={myVote === -1}
		aria-label={label(-1)}
		title={label(-1)}
		disabled={locked}
		class="grid size-11 place-items-center rounded-xl transition active:scale-90 disabled:cursor-default disabled:opacity-35 {myVote ===
		-1
			? 'bg-sunset text-on-accent shadow-[0_0_14px_rgba(255,179,71,0.45)]'
			: 'border border-line text-ink hover:border-sunset hover:text-sunset'}"
	>
		<Icon name="down" size={22} stroke={2.8} />
	</button>
</form>
