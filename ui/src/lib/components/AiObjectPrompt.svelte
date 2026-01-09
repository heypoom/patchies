<script lang="ts">
	import { Loader, Sparkles, Edit3, Network } from '@lucide/svelte/icons';
	import {
		resolveObjectFromPrompt,
		editObjectFromPrompt,
		resolveMultipleObjectsFromPrompt,
		type SimplifiedEdge
	} from '$lib/ai/object-resolver';
	import type { Node } from '@xyflow/svelte';

	let {
		open = $bindable(false),
		position,
		editingNode = null,
		onInsertObject,
		onInsertMultipleObjects,
		onEditObject
	}: {
		open?: boolean;
		position: { x: number; y: number };
		editingNode?: Node | null;
		onInsertObject: (type: string, data: any) => void;
		onInsertMultipleObjects?: (
			nodes: Array<{ type: string; data: any; position?: { x: number; y: number } }>,
			edges: SimplifiedEdge[]
		) => void;
		onEditObject?: (nodeId: string, data: any) => void;
	} = $props();

	let promptInput: HTMLTextAreaElement | undefined = $state();
	let promptText = $state('');
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let isMultiObjectMode = $state(false);

	const isEditMode = $derived(editingNode !== null);
	const title = $derived(
		isEditMode
			? 'AI Object Edit'
			: isMultiObjectMode
				? 'AI Multi-Object Insert'
				: 'AI Object Insert'
	);
	const description = $derived(
		isEditMode
			? `Editing: ${editingNode?.data?.name || editingNode?.data?.title || editingNode?.type || 'object'}`
			: isMultiObjectMode
				? 'Describe connected objects to create'
				: 'Describe the object you want to create'
	);
	const buttonText = $derived(isEditMode ? 'Update' : 'Insert');
	const placeholderText = $derived(
		isEditMode
			? 'e.g., "make it go faster"'
			: isMultiObjectMode
				? 'e.g., "slider controlling oscillator frequency"'
				: 'e.g., "a bouncing ball"'
	);

	// Auto-focus input when opened
	$effect(() => {
		if (open) {
			setTimeout(() => {
				promptInput?.focus();
			}, 0);
		}
	});

	function handleClose() {
		// Prevent closing while AI is generating
		if (isLoading) return;

		open = false;
		promptText = '';
		errorMessage = null;
		isLoading = false;
		// Don't reset mode - keep user's preference
	}

	function handleClickOutside(event: MouseEvent) {
		// Prevent closing while AI is generating
		if (isLoading) return;

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
			if (isMultiObjectMode && !isEditMode) {
				// Multi-object mode: create multiple connected objects
				const result = await resolveMultipleObjectsFromPrompt(promptText);

				if (result && result.nodes.length > 0) {
					if (onInsertMultipleObjects) {
						onInsertMultipleObjects(result.nodes, result.edges);
					}
					// Reset loading state before closing so handleClose() doesn't block
					isLoading = false;
					handleClose();
				} else {
					errorMessage = 'Could not resolve objects from prompt';
					isLoading = false;
				}
			} else {
				// Single object mode: use two-stage routing pattern
				let result;

				if (isEditMode && editingNode) {
					// Edit mode: Use single-call editObjectFromPrompt (more efficient)
					const nodeType = editingNode.type || 'unknown';
					// Pass all node data - JSON.stringify will handle serialization,
					// non-serializable objects become [object Object] which is fine
					const existingData = editingNode.data || {};
					result = await editObjectFromPrompt(promptText, nodeType, existingData);
				} else {
					// Insert mode: Use two-call resolveObjectFromPrompt (routing + generation)
					result = await resolveObjectFromPrompt(promptText);
				}

				if (result) {
					if (isEditMode && onEditObject) {
						// In edit mode, only update the data
						onEditObject(editingNode!.id, result.data);
					} else {
						// In insert mode, create a new object
						onInsertObject(result.type, result.data);
					}
					// Reset loading state before closing so handleClose() doesn't block
					isLoading = false;
					handleClose();
				} else {
					errorMessage = 'Could not resolve object from prompt';
					isLoading = false;
				}
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			isLoading = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			// Prevent closing while AI is generating
			if (!isLoading) {
				handleClose();
			}
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
		class="ai-prompt-dialog absolute z-50 w-96 rounded-lg border {isLoading
			? 'border-purple-500'
			: 'border-zinc-600'} bg-zinc-900/95 shadow-2xl backdrop-blur-xl {isLoading
			? 'ring-2 ring-purple-500/50'
			: ''}"
		style="left: {position.x}px; top: {position.y}px;"
	>
		<!-- Header -->
		<div class="flex items-center gap-2 border-b border-zinc-700 px-4 py-3">
			{#if isEditMode}
				<Edit3 class="h-5 w-5 text-amber-400" />
			{:else if isMultiObjectMode}
				<Network class="h-5 w-5 text-blue-400" />
			{:else}
				<Sparkles class="h-5 w-5 text-purple-400" />
			{/if}
			<div class="flex-1">
				<div class="font-mono text-sm font-medium text-zinc-100">{title}</div>
				<div class="text-xs text-zinc-400">{description}</div>
			</div>

			<!-- Mode Toggle (only show when not in edit mode) -->
			{#if !isEditMode}
				<button
					onclick={() => (isMultiObjectMode = !isMultiObjectMode)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							isMultiObjectMode = !isMultiObjectMode;
						}
					}}
					class="rounded px-2 py-1 text-xs font-medium transition-colors {isMultiObjectMode
						? 'bg-blue-600 text-white'
						: 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}"
					title="Toggle between single and multiple object mode"
					aria-label="Toggle between single and multiple object mode"
					aria-pressed={isMultiObjectMode}
				>
					{isMultiObjectMode ? 'Multi' : 'Single'}
				</button>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="p-4">
			<textarea
				bind:this={promptInput}
				bind:value={promptText}
				onkeydown={handleKeydown}
				placeholder={placeholderText}
				disabled={isLoading}
				class="nodrag w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-500 outline-none {isEditMode
					? 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
					: 'focus:border-purple-500 focus:ring-1 focus:ring-purple-500'} disabled:cursor-not-allowed disabled:opacity-60"
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
				{:else if isEditMode}
					Enter to update • Esc to cancel
				{:else}
					Enter to insert • Esc to cancel
				{/if}
			</div>

			<button
				onclick={handleSubmit}
				disabled={!promptText.trim() || isLoading}
				class="rounded {isEditMode
					? 'bg-amber-600 hover:bg-amber-700'
					: isMultiObjectMode
						? 'bg-blue-600 hover:bg-blue-700'
						: 'bg-purple-600 hover:bg-purple-700'} px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? 'Resolving...' : buttonText}
			</button>
		</div>
	</div>
{/if}
