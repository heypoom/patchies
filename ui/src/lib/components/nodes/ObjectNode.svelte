<script lang="ts">
	import {
		useEdges,
		useSvelteFlow,
		useUpdateNodeInternals
	} from '@xyflow/svelte';
	import { onDestroy, onMount } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { nodeNames } from '$lib/nodes/node-types';
	import {
		getObjectNames,
		getObjectDefinition,
		audioObjectNames,
		getObjectNameFromExpr,
		objectDefinitions,
		type AdsrParamList
	} from '$lib/objects/object-definitions';
	import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { PRESETS } from '$lib/presets/presets';
	import Fuse from 'fuse.js';
	import * as Tooltip from '../ui/tooltip';
	import {
		isUnmodifiableType,
		parseObjectParamFromString,
		stringifyParamByType
	} from '$lib/objects/parse-object-param';
	import { validateMessageToObject } from '$lib/objects/validate-object-message';
	import { isScheduledMessage } from '$lib/audio/time-scheduling-types';
	import type { PsAudioType } from '$lib/audio/audio-node-types';
	import { getFileNameFromUrl } from '$lib/utils/sound-url';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { expr: string; name: string; params: unknown[] };
		selected: boolean;
	} = $props();

	const { updateNodeData, deleteElements, updateNode, getEdges } = useSvelteFlow();

	const edgesHelper = useEdges();
	const updateNodeInternals = useUpdateNodeInternals();

	let inputElement = $state<HTMLInputElement>();
	let nodeElement = $state<HTMLDivElement>();
	let resultsContainer = $state<HTMLDivElement>();
	let expr = $state(data.expr || '');
	let isEditing = $state(!data.expr); // Start in editing mode if no name;
	let showAutocomplete = $state(false);
	let selectedSuggestion = $state(0);
	let originalName = data.expr || ''; // Store original name for escape functionality

	let isAutomated = $state<Record<number, boolean>>({});
	let metroInterval = $state<ReturnType<typeof setInterval> | null>(null);

	let audioSystem = AudioSystem.getInstance();
	const messageContext = new MessageContext(nodeId);

	// Combine all searchable items (objects + presets) with metadata
	const allSearchableItems = $derived.by(() => {
		const objectDefNames = getObjectNames();
		const visualNodeList = nodeNames.filter((name) => name !== 'object');
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
			threshold: 0.2,
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
		// Transform current name and parameter into editable expr
		const paramString = data.params
			.map((value, index) => stringifyParamByType(inlets[index], value, index))
			.filter((value, index) => !isUnmodifiableType(inlets[index]?.type))
			.join(' ');

		expr = `${data.name} ${paramString}`;

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

	function updateParamByIndex(index: number, value: unknown) {
		const nextParams = [...data.params];
		nextParams[index] = value;
		updateNodeData(nodeId, { ...data, params: nextParams });

		isAutomated = { ...isAutomated, [index]: false };
	}

	const handleMessage: MessageCallbackFn = (message, meta) => {
		if (!objectDef || !objectDef.inlets || meta?.inlet === undefined) return;

		const inlet = objectDef.inlets[meta.inlet];
		if (!inlet) return;

		// Validate message type against inlet specification
		if (!validateMessageToObject(message, inlet)) {
			console.warn(
				`invalid message type for ${data.name} inlet ${inlet.name}: expected ${inlet.type}, got`,
				message
			);

			return;
		}

		const isScheduled = isScheduledMessage(message);
		const isSetImmediate = isScheduled && message.type === 'set' && message.time === undefined;

		if (!isUnmodifiableType(inlet.type) && !isScheduled) {
			// Do not update parameter if it is a unmodifiable type or a scheduled message.
			updateParamByIndex(meta.inlet, message);
		} else if (isSetImmediate) {
			// Update parameters for a simple `set` message.
			updateParamByIndex(meta.inlet, message.value);
		} else if (isScheduled) {
			// Mark parameter as being automated.
			isAutomated = { ...isAutomated, [meta.inlet]: true };
		}

		if (inlet.name && objectDef.tags?.includes('audio')) {
			audioSystem.send(nodeId, inlet.name, message);

			return;
		}

		match([data.name, inlet.name, message])
			.with(['mtof', 'note', P.number], ([, , note]) => {
				messageContext.send(440 * Math.pow(2, (note - 69) / 12));
			})
			.with(['delay', 'message', P.any], ([, , message]) => {
				const [_, delayMs] = data.params as [unknown, number];

				setTimeout(() => {
					messageContext.send(message);
				}, delayMs ?? 0);
			})
			.with(['adsr', 'trigger', P.any], ([, , trigger]) => {
				const [_, peak, attack, decay, sustain, release] = data.params as AdsrParamList;

				if (trigger === 0 || trigger === false) {
					messageContext.send({ type: 'release', release: { time: release / 1000 }, endValue: 0 });
				} else {
					messageContext.send({
						type: 'trigger',
						values: { start: 0, peak, sustain },
						attack: { time: attack / 1000 },
						decay: { time: decay / 1000 }
					});
				}
			})
			.with(['metro', 'message', P.any], ([, , controlMsg]) => {
				match(controlMsg)
					.with({ type: 'start' }, () => {
						const intervalMs = data.params[1] as number;
						startMetro(intervalMs);
					})
					.with({ type: 'stop' }, () => {
						stopMetro();
					})
					.with({ type: 'bang' }, () => {
						if (metroInterval !== null) {
							stopMetro();
						} else {
							const intervalMs = data.params[1] as number;
							startMetro(intervalMs);
						}
					});
			})
			.with(['metro', 'interval', P.number], ([, , intervalMs]) => {
				updateParamByIndex(1, intervalMs);
				if (metroInterval !== null) {
					startMetro(intervalMs);
				}
			});
	};

	function handleNameChange() {
		if (tryCreatePreset()) return;
		if (tryTransformToVisualNode()) return;
		if (tryCreateAudioObject()) return;

		tryCreatePlainObject();
	}

	function getNameAndParams() {
		const parts = expr.trim().split(' ');
		const name = parts[0]?.toLowerCase();
		const params = parts.slice(1);

		return { name, params: parseObjectParamFromString(name, params) };
	}

	function onObjectLoad(name: string, params: unknown[]) {
		match(name)
			.with('loadbang', () => {
				setTimeout(() => {
					messageContext.send({ type: 'bang' });
				}, 500);
			})
			.with('metro', () => {
				stopMetro();

				const intervalMs = params[1] as number;
				startMetro(intervalMs);
			});
	}

	function startMetro(intervalMs: number) {
		stopMetro();
		metroInterval = setInterval(() => {
			messageContext.send({ type: 'bang' });
		}, intervalMs);
	}

	function stopMetro() {
		if (metroInterval !== null) {
			clearInterval(metroInterval);
			metroInterval = null;
		}
	}

	function tryCreatePlainObject() {
		const { name, params } = getNameAndParams();

		updateNodeData(nodeId, { ...data, expr, name, params });
		onObjectLoad(name, params);
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

	function syncAudioSystem(name: string, params: unknown[]) {
		audioSystem.removeAudioObject(nodeId);
		audioSystem.createAudioObject(nodeId, name as PsAudioType, params);

		const edges = getEdges();
		audioSystem.updateEdges(edges);
	}

	function tryCreateAudioObject() {
		if (!expr.trim()) return false;

		const { name, params } = getNameAndParams();
		updateNodeData(nodeId, { ...data, expr, name, params });

		if (!audioObjectNames.includes(name)) return false;

		syncAudioSystem(name, params);

		return true;
	}

	const changeNode = (type: string, data: Record<string, unknown>) => {
		const nodeNumber = parseInt(nodeId.replace('object-', ''));
		const nextId = `${type}-${nodeNumber}`;

		updateNode(nodeId, { id: nextId, type, data });

		edgesHelper.update((edges) =>
			edges.map((edge) => {
				if (edge.source === nodeId) return { ...edge, source: nextId };
				if (edge.target === nodeId) return { ...edge, target: nextId };

				return edge;
			})
		);

		updateNodeInternals(nextId);
	};

	function tryTransformToVisualNode() {
		const name = getObjectNameFromExpr(expr);
		if (!name) return false;

		return match(name)
			.with(P.union('msg', 'm'), () => {
				changeNode('msg', { message: expr.replace(name, '').trim() });

				return true;
			})
			.with(P.union('button', 'bang'), () => {
				changeNode('button', { message: expr.replace(name, '').trim() });

				return true;
			})
			.with('soundurl~', () => {
				const url = expr.replace(name, '').trim();
				const fileName = getFileNameFromUrl(url);

				changeNode('soundfile~', { fileName, url });

				return true;
			})
			.with('expr', () => {
				changeNode('expr', { expr: expr.replace(name, '').trim() });

				return true;
			})
			.with(P.union('netsend', 'netrecv'), (key) => {
				changeNode(key, { channel: expr.replace(name, '').trim() });

				return true;
			})
			.with('slider', () => {
				let [min = 0, max = 100, defaultValue] = expr
					.replace(name, '')
					.trim()
					.split(' ')
					.map(Number);

				if (defaultValue === undefined) {
					defaultValue = (min + max) / 2;
				}

				changeNode('slider', { min, max, defaultValue, isFloat: false });

				return true;
			})
			.with('fslider', () => {
				let [min = 0, max = 1, defaultValue] = expr.replace(name, '').trim().split(' ').map(Number);

				if (defaultValue === undefined) {
					defaultValue = (min + max) / 2;
				}

				changeNode('slider', { min, max, defaultValue, isFloat: true });

				return true;
			})
			.otherwise(() => {
				if (nodeNames.includes(name as any)) {
					changeNode(name, getDefaultNodeData(name));

					return true;
				}

				return false;
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
			.with('Enter', () => {
				event.preventDefault();
				if (filteredSuggestions[selectedSuggestion]) {
					expr = filteredSuggestions[selectedSuggestion].name;
					showAutocomplete = false;
					exitEditingMode(true);
				}
			})
			.with('Tab', () => {
				event.preventDefault();

				if (filteredSuggestions[selectedSuggestion]) {
					expr = filteredSuggestions[selectedSuggestion].name;
					showAutocomplete = false;
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

	const containerClass = $derived(
		selected ? 'border-zinc-400 bg-zinc-800/80' : 'border-zinc-700 bg-zinc-900/80'
	);

	onMount(() => {
		if (isEditing) {
			setTimeout(() => inputElement?.focus(), 10);
		}

		if (audioObjectNames.includes(data.name)) {
			syncAudioSystem(data.name, data.params);
		}

		messageContext.queue.addCallback(handleMessage);
		onObjectLoad(data.name, data.params);
	});

	onDestroy(() => {
		audioSystem.removeAudioObject(nodeId);
		stopMetro();
	});

	const getInletTypeHoverClass = (inletIndex: number) => {
		const type = inlets[inletIndex]?.type;

		if (isAutomated[inletIndex]) {
			return 'hover:text-pink-500 cursor-pointer hover:underline';
		}

		return match(type)
			.with('float', () => 'hover:text-yellow-500 cursor-pointer hover:underline')
			.with('int', () => 'hover:text-yellow-500 cursor-pointer hover:underline')
			.with('string', () => 'hover:text-blue-500 cursor-pointer hover:underline')
			.with('bool', () => 'hover:text-violet-500 cursor-pointer hover:underline')
			.otherwise(() => 'hover:text-zinc-400');
	};

	const getInletHint = (inletIndex: number) => {
		const inlet = inlets[inletIndex];
		if (!inlet) return 'unknown inlet';

		if (inlet.type === 'string' && inlet.options) {
			return `${inlet.name} (${inlet.options.join(', ')})`;
		}

		return `${inlet.name} (${inlet.type})`;
	};

	const getShortInletName = (inletIndex: number) => inlets[inletIndex]?.name?.slice(0, 4) || 'auto';
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<!-- Dynamic inlets -->
				{#if inlets.length > 0}
					{#each inlets as inlet, index}
						<StandardHandle
							port="inlet"
							type={inlet.type === 'signal' ? 'audio' : 'message'}
							id={index}
							title={inlet.name || `Inlet ${index}`}
							total={inlets.length}
							index={index}
							class="top-0"
						/>
					{/each}
				{:else}
					<!-- Fallback generic inlet for objects without definitions -->
					<StandardHandle port="inlet" type="message" total={1} index={0} />
				{/if}

				<div class="relative">
					{#if isEditing}
						<!-- Editing state: show input field -->
						<div class={['w-fit rounded-lg border backdrop-blur-lg', containerClass]}>
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
								class="absolute top-full left-0 z-50 mt-1 w-full min-w-48 rounded-md border border-zinc-800 bg-zinc-900/80 shadow-xl backdrop-blur-lg"
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
								'w-full cursor-pointer rounded-lg border px-3 py-2 backdrop-blur-lg',
								containerClass
							]}
							ondblclick={handleDoubleClick}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
						>
							<div class="font-mono text-xs">
								<span class={[!objectDefinitions[data.name] ? 'text-red-300' : 'text-zinc-200']}
									>{data.name}</span
								>

								{#each data.params as param, index}
									{#if !isUnmodifiableType(inlets[index]?.type)}
										<Tooltip.Root>
											<Tooltip.Trigger>
												<span
													class={[
														'text-zinc-400 underline-offset-2',
														getInletTypeHoverClass(index)
													]}
												>
													{#if isAutomated[index]}
														{getShortInletName(index)}
													{:else}
														{stringifyParamByType(inlets[index], param, index)}
													{/if}
												</span>
											</Tooltip.Trigger>
											<Tooltip.Content>
												<p>{getInletHint(index)}</p>

												{#if inlets[index]?.description}
													<p class="text-xs text-zinc-500">{inlets[index].description}</p>
												{/if}

												{#if isAutomated[index]}
													<p class="text-xs text-pink-500">inlet is automated</p>
												{/if}
											</Tooltip.Content>
										</Tooltip.Root>
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Dynamic outlets -->
				{#if outlets.length > 0}
					{#each outlets as outlet, index}
						<StandardHandle
							port="outlet"
							type={outlet.type === 'signal' ? 'audio' : 'message'}
							id={index}
							title={outlet.name || `Outlet ${index}`}
							total={outlets.length}
							index={index}
							class="bottom-0"
						/>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>
