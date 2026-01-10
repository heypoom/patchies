<script lang="ts">
	import { Copy, ClipboardPaste } from '@lucide/svelte/icons';

	let {
		open = $bindable(false),
		canCopy = false,
		canPaste = false,
		onCopy,
		onPaste
	}: {
		open?: boolean;
		canCopy: boolean;
		canPaste: boolean;
		onCopy: () => void;
		onPaste: () => void;
	} = $props();

	function handleCopy() {
		onCopy();
		open = false;
	}

	function handlePaste() {
		onPaste();
		open = false;
	}

	function handleClose() {
		open = false;
	}

	// Handle escape key
	$effect(() => {
		if (!open) return;

		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				handleClose();
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if open}
	<!-- Modal backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				handleClose();
			}
		}}
	>
		<!-- Backdrop overlay -->
		<div class="pointer-events-none fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true"
		></div>

		<!-- Modal container -->
		<div
			class="relative z-10 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="copy-paste-title"
		>
			<h2 id="copy-paste-title" class="mb-4 text-center text-sm font-medium text-zinc-200">
				Copy / Paste
			</h2>

			<div class="space-y-2">
				{#if canCopy}
					<button
						onclick={handleCopy}
						class="flex w-full items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-left text-zinc-200 transition-colors hover:bg-zinc-700"
					>
						<Copy class="h-5 w-5" />
						<span>Copy</span>
					</button>
				{/if}

				{#if canPaste}
					<button
						onclick={handlePaste}
						class="flex w-full items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-left text-zinc-200 transition-colors hover:bg-zinc-700"
					>
						<ClipboardPaste class="h-5 w-5" />
						<span>Paste</span>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
