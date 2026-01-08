<script lang="ts">
	import { Loader, Sparkles } from '@lucide/svelte/icons';
	import { resolveObjectFromPrompt } from '$lib/ai/object-resolver';

	let {
		open = $bindable(false),
		position,
		onInsertObject
	}: {
		open?: boolean;
		position: { x: number; y: number };
		onInsertObject: (type: string, data: any) => void;
	} = $props();

	let promptInput: HTMLTextAreaElement | undefined = $state();
	let promptText = $state('');
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);

	// Auto-focus input when opened
	$effect(() => {
		if (open) {
			setTimeout(() => {
				promptInput?.focus();
			}, 0);
		}
	});

	function handleClose() {
		open = false;
		promptText = '';
		errorMessage = null;
		isLoading = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.ai-prompt-dialog')) {
			handleClose();
		}
	}

	async function handleSubmit() {
		if (!promptText.trim() || isLoading) return;

		isLoading = true;
		errorMessage = null;

		try {
			const result = await resolveObjectFromPrompt(promptText);

			if (result) {
				onInsertObject(result.type, result.data);
				handleClose();
			} else {
				errorMessage = 'Could not resolve object from prompt';
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

{#if open}
	<div
		class="ai-prompt-dialog absolute z-50 w-96 rounded-lg border border-zinc-600 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
		style="left: {position.x}px; top: {position.y}px;"
	>
		<!-- Header -->
		<div class="flex items-center gap-2 border-b border-zinc-700 px-4 py-3">
			<Sparkles class="h-5 w-5 text-purple-400" />
			<div class="flex-1">
				<div class="font-mono text-sm font-medium text-zinc-100">AI Object Insert</div>
				<div class="text-xs text-zinc-400">Describe the object you want to create</div>
			</div>
		</div>

		<!-- Input Area -->
		<div class="p-4">
			<textarea
				bind:this={promptInput}
				bind:value={promptText}
				onkeydown={handleKeydown}
				placeholder="e.g., &quot;give me a simple fat sine oscillator&quot;"
				class="nodrag w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
				rows="3"
			></textarea>

			{#if errorMessage}
				<div class="mt-2 rounded bg-red-900/20 px-3 py-2 font-mono text-xs text-red-300">
					{errorMessage}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between border-t border-zinc-700 px-4 py-3">
			<div class="text-xs text-zinc-500">
				{#if isLoading}
					<span class="flex items-center gap-2">
						<Loader class="h-3 w-3 animate-spin" />
						Resolving...
					</span>
				{:else}
					Enter to insert • Esc to cancel
				{/if}
			</div>

			<button
				onclick={handleSubmit}
				disabled={!promptText.trim() || isLoading}
				class="rounded bg-purple-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? 'Resolving...' : 'Insert'}
			</button>
		</div>
	</div>
{/if}
