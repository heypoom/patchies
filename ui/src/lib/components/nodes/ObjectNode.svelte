<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount } from 'svelte';
	import { nodeNames } from '$lib/nodes/node-types';
	import { getObjectNames, getObjectDefinition } from '$lib/objects/objectDefinitions';
	import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
	import { AudioSystem } from '$lib/audio/AudioSystem';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { name: string }; selected: boolean } = $props();

	const { updateNodeData, deleteElements, updateNode } = useSvelteFlow();

	let inputElement = $state<HTMLInputElement>();
	let name = $state(data.name || '');
	let isEditing = $state(!(data.name || '')); // Start in editing mode if no name
	let showAutocomplete = $state(false);
	let selectedSuggestion = $state(0);
	let originalName = data.name || ''; // Store original name for escape functionality

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
		if (!name || name.trim() === '') return null;
		return getObjectDefinition(name.trim());
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

	// Visual nodes that should be transformed when typed
	const visualNodeMappings = {
		bang: 'bang',
		msg: 'msg',
		bchrn: 'bchrn',
		p5: 'p5',
		js: 'js',
		hydra: 'hydra',
		swgl: 'swgl',
		canvas: 'canvas',
		glsl: 'glsl',
		strudel: 'strudel',
		'bg.out': 'bg.out',
		'ai.txt': 'ai.txt',
		'ai.img': 'ai.img',
		'ai.music': 'ai.music',
		'ai.tts': 'ai.tts',
		'midi.in': 'midi.in',
		'midi.out': 'midi.out'
	};

	const filteredSuggestions = $derived.by(() => {
		if (!isEditing || !name || name.length === 0) {
			return [];
		}
		return allObjectNames
			.filter((objName) => objName.toLowerCase().startsWith(name.toLowerCase()))
			.slice(0, 6); // Show max 6 suggestions
	});

	function enterEditingMode() {
		isEditing = true;
		originalName = name;
		showAutocomplete = false;
		// Focus input on next tick
		setTimeout(() => inputElement?.focus(), 0);
	}

	function exitEditingMode(save: boolean = true) {
		isEditing = false;
		showAutocomplete = false;

		if (!save) {
			// Restore original name on escape
			name = originalName;

			// If the original name was empty, delete the node
			if (!originalName.trim()) {
				deleteElements({ nodes: [{ id: nodeId }] });
				return;
			}
		}

		if (save) {
			if (name.trim()) {
				handleNameChange();
				// Try transformation after a short delay to ensure the name is saved
				setTimeout(() => tryTransformToVisualNode(), 50);
			} else {
				// If trying to save with empty name, delete the node
				deleteElements({ nodes: [{ id: nodeId }] });
			}
		}
	}

	function handleNameChange() {
		updateNodeData(nodeId, { ...data, name });

		// Check if this should transform to a visual node
		tryTransformToVisualNode();
	}

	function tryTransformToVisualNode() {
		const trimmedName = name.trim().toLowerCase();
		const targetNodeType = visualNodeMappings[trimmedName as keyof typeof visualNodeMappings];

		if (targetNodeType) {
			// Transform this object node to the target visual node type
			const defaultData = getDefaultNodeData(targetNodeType);

			// Update the node type and data
			updateNode(nodeId, {
				type: targetNodeType,
				data: defaultData
			});
		}
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
					name = filteredSuggestions[selectedSuggestion];
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
		name = suggestion;
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
			if (!name.trim()) {
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

	const borderColor = $derived(selected ? 'border-zinc-400' : 'border-zinc-600');

	onMount(() => {
		// Auto-focus if starting in editing mode
		if (isEditing) {
			setTimeout(() => inputElement?.focus(), 0);
		}
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
							class="z-1 top-0"
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
						<div class={['rounded-lg border bg-zinc-900', borderColor]}>
							<input
								bind:this={inputElement}
								bind:value={name}
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
								class="absolute left-0 top-full z-50 mt-1 w-full min-w-24 rounded-md border border-zinc-600 bg-zinc-800 shadow-xl"
							>
								{#each filteredSuggestions as suggestion, index}
									<button
										type="button"
										onclick={() => selectSuggestion(suggestion)}
										class={[
											'w-full px-3 py-2 text-left font-mono text-xs text-zinc-200 hover:bg-zinc-700',
											index === selectedSuggestion ? 'bg-zinc-700' : '',
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
							class={[
								'w-full min-w-24 cursor-pointer rounded-lg border bg-zinc-900 px-3 py-2',
								borderColor
							]}
							ondblclick={handleDoubleClick}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
						>
							<div class="font-mono text-xs text-zinc-200">
								{name}
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
