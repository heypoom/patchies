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
	let resolvedObjectType = $state<string | null>(null);
	let isGeneratingConfig = $state(false);
	let abortController: AbortController | null = $state(null);
	let isDragging = $state(false);
	let dragOffset = $state({ x: 0, y: 0 });
	let dialogPosition = $state({ x: position.x, y: position.y });

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

	// Auto-focus input when opened and reset position
	$effect(() => {
		if (open) {
			dialogPosition = { x: position.x, y: position.y };
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
		resolvedObjectType = null;
		isGeneratingConfig = false;
		abortController = null;
		// Don't reset mode - keep user's preference
	}

	function handleCancel() {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		isLoading = false;
		errorMessage = 'Request cancelled';
	}

	function handleClickOutside(event: MouseEvent) {
		// Prevent closing while AI is generating or dragging
		if (isLoading || isDragging) return;

		const target = event.target as HTMLElement;
		if (!target.closest('.ai-prompt-dialog')) {
			handleClose();
		}
	}

	function handleHeaderMouseDown(event: MouseEvent) {
		// Only start drag on left click and not on buttons
		if (event.button !== 0) return;
		const target = event.target as HTMLElement;
		if (target.closest('button')) return;

		isDragging = true;
		dragOffset = {
			x: event.clientX - dialogPosition.x,
			y: event.clientY - dialogPosition.y
		};
		event.preventDefault();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		dialogPosition = {
			x: event.clientX - dragOffset.x,
			y: event.clientY - dragOffset.y
		};
	}

	function handleMouseUp() {
		isDragging = false;
	}

	async function handleSubmit() {
		if (!promptText.trim() || isLoading) return;

		isLoading = true;
		errorMessage = null;
		resolvedObjectType = null;
		isGeneratingConfig = false;
		abortController = new AbortController();

		try {
			if (isMultiObjectMode && !isEditMode) {
				// Multi-object mode: create multiple connected objects
				const result = await resolveMultipleObjectsFromPrompt(
					promptText,
					(objectTypes) => {
						// Deduplicate object types while preserving order
						const uniqueTypes = Array.from(new Set(objectTypes));
						resolvedObjectType = uniqueTypes.join(', ');
						isGeneratingConfig = true;
					},
					abortController.signal
				);

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
					// Pass callback to show object type after router completes
					result = await resolveObjectFromPrompt(
						promptText,
						(objectType) => {
							resolvedObjectType = objectType;
							isGeneratingConfig = true;
						},
						abortController.signal
					);
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
		} else if (event.key === 'i' && (event.metaKey || event.ctrlKey)) {
			// CMD+I (or Ctrl+I on Windows/Linux) toggles between single and multi mode
			// Only works in insert mode (not edit mode)
			if (!isEditMode) {
				event.preventDefault();

				isMultiObjectMode = !isMultiObjectMode;
			}
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside);
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			return () => {
				document.removeEventListener('click', handleClickOutside);
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
		}
	});
</script>

{#if open}
	<div
		class="ai-prompt-dialog absolute z-50 w-96 rounded-lg border {isLoading
			? isEditMode
				? 'border-amber-500'
				: isMultiObjectMode
					? 'border-blue-500'
					: 'border-purple-500'
			: 'border-zinc-600'} bg-zinc-900/95 shadow-2xl backdrop-blur-xl {isLoading
			? isEditMode
				? 'ring-2 ring-amber-500/50'
				: isMultiObjectMode
					? 'ring-2 ring-blue-500/50'
					: 'ring-2 ring-purple-500/50'
			: ''} {isDragging ? 'cursor-grabbing' : ''}"
		style="left: {dialogPosition.x}px; top: {dialogPosition.y}px;"
	>
		<!-- Header -->
		<div
			class="flex items-center gap-2 border-b border-zinc-700 px-4 py-3 {isDragging
				? 'cursor-grabbing'
				: 'cursor-grab'}"
			onmousedown={handleHeaderMouseDown}
			role="button"
			tabindex="-1"
		>
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
					class="cursor-pointer rounded px-2 py-1 text-xs font-medium transition-colors {isMultiObjectMode
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
					: isMultiObjectMode
						? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
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
					<div class="flex items-center gap-2">
						<Loader class="h-3 w-3 animate-spin" />
						{#if isGeneratingConfig}
							<div class="mr-[2px] flex flex-col gap-1">
								<span class="overflow-hidden text-zinc-400">
									Cooking <span class="text-zinc-300">{resolvedObjectType}</span>...
								</span>
							</div>
						{:else if !isEditMode}
							<span>Routing...</span>
						{:else}
							<span>Editing...</span>
						{/if}
					</div>
				{:else if isEditMode}
					Enter to update • Esc to cancel
				{:else}
					Enter to insert • Ctrl+I to {isMultiObjectMode ? 'single' : 'multi'} • Esc to cancel
				{/if}
			</div>

			<div class="flex gap-2">
				{#if isLoading}
					<button
						onclick={handleCancel}
						class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white cursor-pointer"
					>
						Cancel
					</button>
				{:else}
					<button
						onclick={handleSubmit}
						disabled={!promptText.trim() || isLoading}
						class="cursor-pointer rounded {isEditMode
							? 'bg-amber-600 hover:bg-amber-700'
							: isMultiObjectMode
								? 'bg-blue-600 hover:bg-blue-700'
								: 'bg-purple-600 hover:bg-purple-700'} px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					>
						{buttonText}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
