<script lang="ts">
	let { message, action, onaction }: { message: string; action?: string; onaction?: () => void } =
		$props();
</script>

<div
	role="status"
	class="toast flex items-center justify-between gap-3 rounded-xl bg-ink py-1.5 pr-1.5 pl-4 text-sm font-semibold text-screen shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
>
	<span>{message}</span>
	{#if action}
		<button
			type="button"
			onclick={onaction}
			class="min-h-10 rounded-lg bg-screen px-4 font-bold text-accent transition enabled:active:scale-95"
			>{action}</button
		>
	{/if}
</div>

<style>
	.toast {
		animation: toast-in 0.25s ease-out both;
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
</style>
