<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, getContext } from 'svelte';
	import { nodeNames, type NodeTypeName } from '$lib/nodes/node-types';
	import { getObjectNames, getObjectDefinition } from '$lib/objects/objectDefinitions';
	import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
	import { AudioSystem } from '$lib/audio/AudioSystem';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { expr: string }; selected: boolean } = $props();

	const { updateNodeData, deleteElements, updateNode, getEdges } = useSvelteFlow();

	let inputElement = $state<HTMLInputElement>();
	let nodeElement = $state<HTMLDivElement>();
	let expr = $state(data.expr || '');
	let isEditing = $state(!data.expr); // Start in editing mode if no name;
	let showAutocomplete = $state(false);
	let selectedSuggestion = $state(0);
	let originalName = data.expr || ''; // Store original name for escape functionality

	let audioSystem = AudioSystem.getInstance();

	// Combine visual node names and text-only object names for autocomplete
	const allObjectNames = $derived.by(() => {
		const objectDefNames = getObjectNames();
		const visualNodeList = [...nodeNames];

		// Combine both lists, removing duplicates and ensuring visual nodes take precedence
		const combined = new Set([...visualNodeList, ...objectDefNames]);

		return Array.from(combined).sort();
	});

	// Get object definition for current name (if it exists)
	const objectDef = $derived.by(() => {
		if (!expr || expr.trim() === '') return null;

		return getObjectDefinition(expr);
	});

	// Dynamic inlets based on object definition
	const inlets = $derived.by(() => {
		if (!objectDef) return []; // No definition = no specific inlets
		return objectDef.inlets || [];
	});

	// Dynamic outlets based on object definition
	const outlets = $derived.by(() => {
		if (!objectDef) return []; // No definition = no specific outlets
		return objectDef.outlets || [];
	});

	const filteredSuggestions = $derived.by(() => {
		if (!isEditing) return [];

		// Show first 6 suggestions if input is empty
		if (!expr.trim()) return allObjectNames.slice(0, 6);

		return allObjectNames
			.filter((objName) => objName.toLowerCase().startsWith(expr.toLowerCase()))
			.slice(0, 6); // Show max 6 suggestions
	});

	function enterEditingMode() {
		isEditing = true;
		originalName = expr;
		showAutocomplete = true;

		// Focus input on next tick
		setTimeout(() => inputElement?.focus(), 10);
	}

	function exitEditingMode(save: boolean = true) {
		isEditing = false;
		showAutocomplete = false;

		if (!save) {
			// Restore original name on escape
			expr = originalName;

			// If the original name was empty, delete the node
			if (!originalName.trim()) {
				deleteElements({ nodes: [{ id: nodeId }] });
				return;
			}
		}

		if (save) {
			if (expr.trim()) {
				handleNameChange();
			} else {
				// If trying to save with empty name, delete the node
				deleteElements({ nodes: [{ id: nodeId }] });
			}
		}

		// Restore focus to the node element after editing
		setTimeout(() => nodeElement?.focus(), 0);
	}

	function handleNameChange() {
		updateNodeData(nodeId, { ...data, expr });

		// Check if this should transform to a visual node
		tryTransformToVisualNode();

		// Create audio object if it's an audio node
		tryCreateAudioObject();
	}

	function tryCreateAudioObject() {
		if (!expr.trim()) return;

		const parts = expr.trim().split(' ');
		const objectName = parts[0]?.toLowerCase();
		const params = parts.slice(1);

		// Check if this is an audio object type
		const audioObjectTypes = ['osc', 'gain', 'dac'];

		if (audioObjectTypes.includes(objectName)) {
			// Remove existing audio object first to avoid duplicates
			audioSystem.removeAudioObject(nodeId);
			audioSystem.createAudioObject(nodeId, objectName, params);
			
			// Restore audio connections after creating new object
			const edges = getEdges();
			audioSystem.updateEdges(edges);
		}
	}

	function tryTransformToVisualNode() {
		if (!expr.trim()) return;

		const name = expr.trim().split(' ')?.[0]?.toLowerCase() as NodeTypeName;
		if (!nodeNames.includes(name)) return;

		updateNode(nodeId, {
			type: name,
			data: getDefaultNodeData(name)
		});
	}

	function handleInput() {
		if (isEditing) {
			showAutocomplete = filteredSuggestions.length > 0;
			selectedSuggestion = 0;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isEditing) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			exitEditingMode(false);
			return;
		}

		if (!showAutocomplete) {
			if (event.key === 'Enter') {
				event.preventDefault();
				exitEditingMode(true);
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedSuggestion = Math.min(selectedSuggestion + 1, filteredSuggestions.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedSuggestion = Math.max(selectedSuggestion - 1, 0);
				break;
			case 'Enter':
			case 'Tab':
				event.preventDefault();
				if (filteredSuggestions[selectedSuggestion]) {
					expr = filteredSuggestions[selectedSuggestion];
					showAutocomplete = false;
					exitEditingMode(true);
				}
				break;
			case 'Escape':
				event.preventDefault();
				exitEditingMode(false);
				break;
		}
	}

	function selectSuggestion(suggestion: string) {
		expr = suggestion;
		showAutocomplete = false;
		exitEditingMode(true);

		// Try transformation after setting the name
		setTimeout(() => tryTransformToVisualNode(), 0);
	}

	function handleBlur() {
		if (!isEditing) return;

		// Delay to allow clicks on suggestions
		setTimeout(() => {
			// If input is empty, delete the node
			if (!expr.trim()) {
				deleteElements({ nodes: [{ id: nodeId }] });
			} else {
				exitEditingMode(true);
			}
		}, 200);
	}

	function handleDoubleClick() {
		if (!isEditing) {
			enterEditingMode();
		}
	}

	const borderColor = $derived(selected ? 'border-zinc-400' : 'border-zinc-700');

	onMount(() => {
		if (isEditing) {
			setTimeout(() => inputElement?.focus(), 10);
		}

		// Cleanup function for when node is destroyed
		return () => {
			audioSystem.removeAudioObject(nodeId);
		};
	});
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<!-- Dynamic inlets -->
				{#if inlets.length > 0}
					{#each inlets as inlet, index}
						<Handle
							type="target"
							position={Position.Top}
							id={`inlet-${index}`}
							class="top-0 z-1"
							style={`left: ${inlets.length === 1 ? '50%' : `${35 + (index / (inlets.length - 1)) * 30}%`}`}
						/>
					{/each}
				{:else}
					<!-- Fallback generic inlet for objects without definitions -->
					<Handle type="target" position={Position.Top} class="z-1" />
				{/if}

				<div class="relative">
					{#if isEditing}
						<!-- Editing state: show input field -->
						<div class={['w-fit rounded-lg border bg-zinc-900/80 backdrop-blur-lg', borderColor]}>
							<input
								bind:this={inputElement}
								bind:value={expr}
								oninput={handleInput}
								onblur={handleBlur}
								onkeydown={handleKeydown}
								placeholder="<name>"
								class="nodrag bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none"
							/>
						</div>

						<!-- Autocomplete dropdown -->
						{#if showAutocomplete && filteredSuggestions.length > 0}
							<div
								class="absolute top-full left-0 z-50 mt-1 w-full min-w-24 rounded-md border border-zinc-800 bg-zinc-900/80 shadow-xl backdrop-blur-lg"
							>
								{#each filteredSuggestions as suggestion, index}
									<button
										type="button"
										onclick={() => selectSuggestion(suggestion)}
										class={[
											'w-full cursor-pointer px-3 py-2 text-left font-mono text-xs text-zinc-200 hover:bg-zinc-800/80',
											index === selectedSuggestion ? 'bg-zinc-800/80' : '',
											index === 0 ? 'rounded-t-md' : '',
											index === filteredSuggestions.length - 1 ? 'rounded-b-md' : ''
										]}
									>
										{suggestion}
									</button>
								{/each}
							</div>
						{/if}
					{:else}
						<!-- Locked state: show read-only text -->
						<div
							bind:this={nodeElement}
							class={[
								'w-full cursor-pointer rounded-lg border bg-zinc-900/80 px-3 py-2 backdrop-blur-lg',
								borderColor
							]}
							ondblclick={handleDoubleClick}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
						>
							<div class="font-mono text-xs text-zinc-200">
								{expr}
							</div>
						</div>
					{/if}
				</div>

				<!-- Dynamic outlets -->
				{#if outlets.length > 0}
					{#each outlets as outlet, index}
						<Handle
							type="source"
							position={Position.Bottom}
							id={`outlet-${index}`}
							class="z-1"
							style={`left: ${outlets.length === 1 ? '50%' : `${35 + (index / (outlets.length - 1)) * 30}%`}`}
						/>
					{/each}
				{:else}
					<!-- Fallback generic outlet for objects without definitions -->
					<Handle type="source" position={Position.Bottom} class="z-1" />
				{/if}
			</div>
		</div>
	</div>
</div>
