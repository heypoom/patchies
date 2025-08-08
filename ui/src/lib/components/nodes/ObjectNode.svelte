<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, getContext } from 'svelte';
	import { nodeNames, type NodeTypeName } from '$lib/nodes/node-types';
	import {
		getObjectNames,
		getObjectDefinition,
		validateMessageType,
		audioObjectNames,
		getObjectName
	} from '$lib/objects/objectDefinitions';
	import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { PRESETS } from '$lib/presets/presets';
	import Fuse from 'fuse.js';

	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { expr: string }; selected: boolean } = $props();

	const { updateNodeData, deleteElements, updateNode } = useSvelteFlow();

	let inputElement = $state<HTMLInputElement>();
	let nodeElement = $state<HTMLDivElement>();
	let resultsContainer = $state<HTMLDivElement>();
	let expr = $state(data.expr || '');
	let isEditing = $state(!data.expr); // Start in editing mode if no name;
	let showAutocomplete = $state(false);
	let selectedSuggestion = $state(0);
	let originalName = data.expr || ''; // Store original name for escape functionality

	let audioSystem = AudioSystem.getInstance();
	const messageContext = new MessageContext(nodeId);

	// Combine all searchable items (objects + presets) with metadata
	const allSearchableItems = $derived.by(() => {
		const objectDefNames = getObjectNames();
		const visualNodeList = [...nodeNames];
		const combinedObjectNames = new Set([...visualNodeList, ...objectDefNames]);

		const items: Array<{ name: string; type: 'object' | 'preset' }> = [];

		// Add regular objects
		Array.from(combinedObjectNames).forEach((name) => {
			items.push({ name, type: 'object' });
		});

		// Add presets
		Object.keys(PRESETS).forEach((name) => {
			items.push({ name, type: 'preset' });
		});

		return items;
	});

	// Create single Fuse instance for all items
	const allItemsFuse = $derived.by(() => {
		return new Fuse(allSearchableItems, {
			keys: ['name'],
			threshold: 0.6,
			includeScore: true,
			minMatchCharLength: 1
		});
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

		// Don't show autocomplete if there's a space (user is typing parameters)
		if (expr.includes(' ')) return [];

		// Show all items if input is empty, with objects first
		if (!expr.trim()) {
			const objects = allSearchableItems
				.filter((item) => item.type === 'object')
				.map((item) => ({ name: item.name, type: item.type }));
			const presets = allSearchableItems
				.filter((item) => item.type === 'preset')
				.map((item) => ({ name: item.name, type: item.type }));
			return [
				...objects.sort((a, b) => a.name.localeCompare(b.name)),
				...presets.sort((a, b) => a.name.localeCompare(b.name))
			];
		}

		// Fuzzy search all items (only the first word/object name)
		const results = allItemsFuse.search(expr);

		// Sort results with custom scoring: objects get priority over presets
		const sortedResults = results.sort((a, b) => {
			// First sort by type (objects first)
			if (a.item.type !== b.item.type) {
				return a.item.type === 'object' ? -1 : 1;
			}

			// Then by Fuse score (lower score = better match)
			return (a.score || 0) - (b.score || 0);
		});

		return sortedResults.map((result) => ({ name: result.item.name, type: result.item.type }));
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

	const handleMessage: MessageCallbackFn = (message, meta) => {
		if (!objectDef || !objectDef.inlets || !meta?.inlet) return;

		// Parse inlet information (e.g., "inlet-0" -> index 0)
		const inletMatch = meta.inlet.match(/inlet-(\d+)/);
		if (!inletMatch) return;

		const inletIndex = parseInt(inletMatch[1]);
		const inlet = objectDef.inlets[inletIndex];
		if (!inlet) return;

		// Validate message type against inlet specification
		if (inlet.type && !validateMessageType(message, inlet.type)) {
			console.warn(
				`invalid message type for ${expr} inlet ${inlet.name}: expected ${inlet.type}, got`,
				message
			);

			return;
		}

		if (inlet.name && objectDef.tags?.includes('audio')) {
			audioSystem.setParameter(nodeId, inlet.name, message);
			return;
		}

		const name = getObjectName(expr);

		match([name, message]).with(['mtof', P.number], ([_, note]) => {
			messageContext.send(440 * Math.pow(2, (note - 69) / 12));
		});
	};

	function handleNameChange() {
		// Check if it's a preset command first
		if (tryCreatePreset()) {
			return; // Early return if preset was created
		}

		updateNodeData(nodeId, { ...data, expr });

		// Check if this should transform to a visual node
		tryTransformToVisualNode();

		// Create audio object if it's an audio node
		tryCreateAudioObject();
	}

	function tryCreatePreset(): boolean {
		if (!expr.trim()) return false;

		// Check if the expression exactly matches a preset name
		const preset = PRESETS[expr.trim()];

		if (!preset) {
			return false; // Not a preset
		}

		// Transform to the preset's node type with its data
		changeNode(preset.type, preset.data as Record<string, unknown>);
		return true;
	}

	function tryCreateAudioObject() {
		if (!expr.trim()) return;

		const parts = expr.trim().split(' ');
		const objectName = parts[0]?.toLowerCase();
		const params = parts.slice(1);

		if (audioObjectNames.includes(objectName)) {
			// Remove existing audio object first to avoid duplicates
			audioSystem.removeAudioObject(nodeId);
			audioSystem.createAudioObject(nodeId, objectName, params);
		}
	}

	const changeNode = (type: string, data: Record<string, unknown>) =>
		updateNode(nodeId, { type, data });

	function tryTransformToVisualNode() {
		const name = getObjectName(expr);
		if (!name) return;

		match(name)
			.with(P.union('msg', 'm'), () => {
				changeNode('msg', { message: expr.replace(name, '').trim() });
			})
			.otherwise(() => {
				if (nodeNames.includes(name as any)) {
					changeNode(name, getDefaultNodeData(name));
				}
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

		match(event.key)
			.with('ArrowDown', () => {
				event.preventDefault();
				selectedSuggestion = Math.min(selectedSuggestion + 1, filteredSuggestions.length - 1);
				scrollToSelectedItem();
			})
			.with('ArrowUp', () => {
				event.preventDefault();
				selectedSuggestion = Math.max(selectedSuggestion - 1, 0);
				scrollToSelectedItem();
			})
			.with('Enter', 'Tab', () => {
				event.preventDefault();
				if (filteredSuggestions[selectedSuggestion]) {
					expr = filteredSuggestions[selectedSuggestion].name;
					showAutocomplete = false;
					exitEditingMode(true);
				}
			})
			.with('Escape', () => {
				event.preventDefault();
				exitEditingMode(false);
			});
	}

	function selectSuggestion(suggestion: { name: string; type: 'object' | 'preset' }) {
		expr = suggestion.name;
		showAutocomplete = false;
		exitEditingMode(true);

		// Try transformation after setting the name
		setTimeout(() => tryTransformToVisualNode(), 0);
	}

	function scrollToSelectedItem() {
		if (!resultsContainer) return;

		const selectedElement = resultsContainer.children[selectedSuggestion] as HTMLElement;
		if (!selectedElement) return;

		const containerRect = resultsContainer.getBoundingClientRect();
		const elementRect = selectedElement.getBoundingClientRect();

		// Check if element is below the visible area
		if (elementRect.bottom > containerRect.bottom) {
			selectedElement.scrollIntoView({ block: 'end', behavior: 'smooth' });
		}
		// Check if element is above the visible area
		else if (elementRect.top < containerRect.top) {
			selectedElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
		}
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

		// Register message handler
		messageContext.queue.addCallback(handleMessage);

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
							class={['z-1 top-0', inlet.type === 'signal' && '!bg-blue-500']}
							style={`left: ${inlets.length === 1 ? '50%' : `${35 + (index / (inlets.length - 1)) * 30}%`}`}
							title={inlet.name || `Inlet ${index}`}
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
								class="absolute left-0 top-full z-50 mt-1 w-full min-w-48 rounded-md border border-zinc-800 bg-zinc-900/80 shadow-xl backdrop-blur-lg"
							>
								<!-- Results List -->
								<div bind:this={resultsContainer} class="max-h-60 overflow-y-auto rounded-t-md">
									{#each filteredSuggestions as suggestion, index}
										<button
											type="button"
											onclick={() => selectSuggestion(suggestion)}
											class={[
												'w-full cursor-pointer border-l-2 px-3 py-2 text-left font-mono text-xs transition-colors',
												index === selectedSuggestion
													? 'border-zinc-400 bg-zinc-700/40 text-zinc-100'
													: 'border-transparent text-zinc-300 hover:bg-zinc-800/80'
											]}
										>
											<span class="font-mono">{suggestion.name}</span>

											{#if suggestion.type === 'preset'}
												<span class="text-[10px] text-zinc-500"
													>{PRESETS[suggestion.name].type}</span
												>
											{/if}
										</button>
									{/each}
								</div>

								<!-- Footer with keyboard hints -->
								<div class="rounded-b-md border-zinc-700 px-2 py-1 text-[8px] text-zinc-600">
									<span>↑↓ navigate • Enter select • Esc cancel</span>
								</div>
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
							style={`left: ${outlets.length === 1 ? '50%' : `${35 + (index / (outlets.length - 1)) * 30}%`}`}
							title={outlet.name || `Outlet ${index}`}
							class={['z-1', outlet.type === 'signal' && '!bg-blue-500']}
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
