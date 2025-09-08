<script lang="ts">
	import { onMount } from 'svelte';
	import { match } from 'ts-pattern';
	import {
		isAiFeaturesVisible,
		isBottomBarVisible,
		isFpsMonitorVisible
	} from '../../stores/ui.store';
	import type { Node, Edge } from '@xyflow/svelte';
	import { IpcSystem } from '$lib/canvas/IpcSystem';
	import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { savePatchToLocalStorage } from '$lib/save-load/save-local-storage';
	import { serializePatch, type PatchSaveFormat } from '$lib/save-load/serialize-patch';
	import { appHostUrl, createShareablePatch } from '$lib/api/pb';

	interface Props {
		position: { x: number; y: number };
		onCancel: () => void;
		nodes: Node[];
		edges: Edge[];
		setNodes: (nodes: Node[]) => void;
		setEdges: (edges: Edge[]) => void;
	}

	let { position, onCancel, nodes, edges, setNodes, setEdges }: Props = $props();

	// Component state
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let searchInput: HTMLInputElement | undefined = $state();
	let paletteContainer: HTMLDivElement | undefined = $state();
	let resultsContainer: HTMLDivElement | undefined = $state();
	let ipcSystem = IpcSystem.getInstance();

	type StageName =
		| 'commands'
		| 'save-name'
		| 'load-list'
		| 'delete-list'
		| 'rename-list'
		| 'rename-name'
		| 'gemini-api-key'
		| 'celestiai-api-key';

	// Multi-stage state
	let stage = $state<StageName>('commands');

	let patchName = $state('');
	let savedPatches = $state<string[]>([]);
	let selectedPatchToRename = $state('');
	let geminiApiKey = $state('');
	let celestiaiApiKey = $state('');

	// Base commands for stage 1
	const commands = [
		{ id: 'export-patch', name: 'Export Patch', description: 'Save patch as JSON file' },
		{ id: 'import-patch', name: 'Import Patch', description: 'Load patch from JSON file' },
		{ id: 'save-patch', name: 'Save Patch', description: 'Save patch to local storage' },
		{ id: 'load-patch', name: 'Load Patch', description: 'Load patch from local storage' },
		{ id: 'rename-patch', name: 'Rename Patch', description: 'Rename saved patch' },
		{ id: 'delete-patch', name: 'Delete a Patch', description: 'Delete patch from local storage' },
		{
			id: 'set-gemini-api-key',
			name: 'Set Gemini API Key',
			description: 'Configure Google Gemini API key'
		},
		{
			id: 'set-celestiai-api-key',
			name: 'Set CelestiAi AI API Key',
			description: 'Configure CelestiAi AI API key'
		},
		{
			id: 'toggle-bottom-bar',
			name: 'Toggle Bottom Bar',
			description: 'Show or hide the bottom toolbar'
		},
		{
			id: 'toggle-fps-monitor',
			name: 'Toggle FPS Monitor',
			description: 'Show or hide the FPS monitor'
		},
		{
			id: 'toggle-ai-features',
			name: 'Toggle AI Features',
			description: 'Show or hide AI-related objects and features'
		},
		{
			id: 'open-output-screen',
			name: 'Open Output Screen',
			description: 'Open a secondary output screen for live performances.'
		},
		{
			id: 'enter-fullscreen',
			name: 'Enter fullscreen',
			description: 'Enter fullscreen mode in the main window.'
		},
		{
			id: 'share-patch',
			name: 'Share Patch',
			description: 'Get a shareable link for your patch.'
		},
		{
			id: 'clear-patch',
			name: 'Clear Patch (!!!!)',
			description: 'Remove all nodes and edges from the canvas.'
		}
	];

	// Filtered items based on current stage
	const filteredCommands = $derived.by(() => {
		return commands.filter((cmd) => cmd.name.toLowerCase().includes(searchQuery.toLowerCase()));
	});

	const filteredPatches = $derived.by(() => {
		return savedPatches.filter((patch) => patch.toLowerCase().includes(searchQuery.toLowerCase()));
	});

	// Auto-focus search input
	onMount(() => {
		searchInput?.focus();
		loadSavedPatches();
	});

	// Focus input when stage changes
	$effect(() => {
		if (
			stage === 'save-name' ||
			stage === 'load-list' ||
			stage === 'delete-list' ||
			stage === 'rename-list' ||
			stage === 'rename-name' ||
			stage === 'gemini-api-key' ||
			stage === 'celestiai-api-key' ||
			stage === 'commands'
		) {
			setTimeout(() => {
				searchInput?.focus();
			}, 0);
		}
	});

	function loadSavedPatches() {
		const saved = localStorage.getItem('patchies-saved-patches');
		if (saved) {
			try {
				savedPatches = JSON.parse(saved);
			} catch (e) {
				savedPatches = [];
			}
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		match(event.key)
			.with('Escape', () => {
				event.preventDefault();
				if (stage !== 'commands') {
					// Go back to commands stage
					stage = 'commands';
					searchQuery = '';
					selectedIndex = 0;
					searchInput?.focus();
				} else {
					onCancel();
				}
			})
			.with('ArrowDown', () => {
				event.preventDefault();
				const maxIndex =
					stage === 'commands'
						? filteredCommands.length - 1
						: stage === 'load-list' || stage === 'delete-list' || stage === 'rename-list'
							? filteredPatches.length - 1
							: 0;
				selectedIndex = Math.min(selectedIndex + 1, maxIndex);
				scrollToSelectedItem();
			})
			.with('ArrowUp', () => {
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				scrollToSelectedItem();
			})
			.with('Enter', () => {
				event.preventDefault();
				handleSelect();
			});
	}

	function handleSelect() {
		if (stage === 'commands' && filteredCommands.length > 0) {
			const selectedCommand = filteredCommands[selectedIndex];
			executeCommand(selectedCommand.id);
		} else if (stage === 'save-name' && patchName.trim()) {
			savePatchToLocalStorage({ name: patchName, nodes, edges });
			onCancel();
		} else if (stage === 'load-list' && filteredPatches.length > 0) {
			const selectedPatch = filteredPatches[selectedIndex];
			loadFromLocalStorage(selectedPatch);
		} else if (stage === 'delete-list' && filteredPatches.length > 0) {
			const selectedPatch = filteredPatches[selectedIndex];
			deleteFromLocalStorage(selectedPatch);
		} else if (stage === 'rename-list' && filteredPatches.length > 0) {
			const selectedPatch = filteredPatches[selectedIndex];
			selectedPatchToRename = selectedPatch;
			stage = 'rename-name';
			searchQuery = '';
			patchName = selectedPatch; // Pre-fill with current name
			selectedIndex = 0;
		} else if (stage === 'rename-name' && patchName.trim()) {
			renamePatch();
		} else if (stage === 'gemini-api-key' && geminiApiKey.trim()) {
			saveGeminiApiKey();
		} else if (stage === 'celestiai-api-key' && celestiaiApiKey.trim()) {
			saveCelestiAiApiKey();
		}
	}

	const nextStage = (stageName: StageName) => {
		stage = stageName;
		searchQuery = '';
		selectedIndex = 0;
	};

	function executeCommand(commandId: string) {
		match(commandId)
			.with('export-patch', () => saveToFile())
			.with('import-patch', () => loadFromFile())
			.with('save-patch', () => nextStage('save-name'))
			.with('load-patch', () => nextStage('load-list'))
			.with('delete-patch', () => nextStage('delete-list'))
			.with('rename-patch', () => nextStage('rename-list'))
			.with('set-gemini-api-key', () => {
				nextStage('gemini-api-key');
				geminiApiKey = '';
			})
			.with('set-celestiai-api-key', () => {
				nextStage('celestiai-api-key');
				celestiaiApiKey = '';
			})
			.with('toggle-bottom-bar', () => {
				$isBottomBarVisible = !$isBottomBarVisible;
				onCancel();
			})
			.with('toggle-fps-monitor', () => {
				$isFpsMonitorVisible = !$isFpsMonitorVisible;
				onCancel();
			})
			.with('toggle-ai-features', () => {
				$isAiFeaturesVisible = !$isAiFeaturesVisible;
				onCancel();
			})
			.with('open-output-screen', () => {
				isBackgroundOutputCanvasEnabled.set(false);
				ipcSystem.openOutputWindow();
				onCancel();
			})
			.with('enter-fullscreen', () => {
				document.querySelector('html')?.requestFullscreen();
				onCancel();
			})
			.with('share-patch', async () => {
				const id = await createShareablePatch(patchName, nodes, edges);
				if (id === null) return;

				const url = `${appHostUrl}/?id=${id}`;

				try {
					await navigator.clipboard.writeText(url);
					alert(`Shareable link copied to clipboard: ${url}`);
				} catch {}

				onCancel();
			})
			.with('clear-patch', async () => {
				const ok = confirm(
					'Are you sure you want to delete everything? This action CANNOT be undone.'
				);

				onCancel();

				if (ok) {
					setNodes([]);
					setEdges([]);
					localStorage.removeItem('patchies-patch-autosave');
				}
			})
			.otherwise(() => {
				console.warn(`Unknown command: ${commandId}`);
			});
	}

	function saveToFile() {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const patchJson = serializePatch({ name: patchName, nodes, edges });

		const blob = new Blob([patchJson], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `patch-${timestamp}.json`;
		a.click();
		URL.revokeObjectURL(url);
		onCancel();
	}

	function loadFromFile() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';

		input.onchange = (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (e) => {
					try {
						const patchData = JSON.parse(e.target?.result as string);
						loadPatchData(patchData);
						onCancel();
					} catch (error) {
						console.error('Error loading patch:', error);
					}
				};
				reader.readAsText(file);
			}
		};

		input.click();
	}

	function loadFromLocalStorage(patchName: string) {
		const patchData = localStorage.getItem(`patchies-patch-${patchName}`);
		if (patchData) {
			try {
				const data = JSON.parse(patchData);
				loadPatchData(data);
				onCancel();
			} catch (error) {
				console.error('Error loading patch from storage:', error);
			}
		}
	}

	function loadPatchData(patchSave: PatchSaveFormat) {
		try {
			if (!patchSave || !patchSave.nodes || !patchSave.edges) {
				throw new Error('Invalid patch data format');
			}

			setNodes(patchSave.nodes);
			setEdges(patchSave.edges);

			console.log(
				`[load] found ${patchSave.nodes.length} nodes and ${patchSave.edges.length} edges`
			);

			AudioSystem.getInstance().audioContext.resume();

			patchName = patchSave.name || 'Untitled';
		} catch (error) {
			console.error('Error deserializing patch data:', error);
			throw error;
		}
	}

	function deleteFromLocalStorage(patchName: string) {
		localStorage.removeItem(`patchies-patch-${patchName}`);

		const saved = localStorage.getItem('patchies-saved-patches') || '[]';
		try {
			let savedPatchesList: string[] = JSON.parse(saved);
			savedPatchesList = savedPatchesList.filter((name) => name !== patchName);
			localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatchesList));

			savedPatches = savedPatchesList;

			if (selectedIndex >= savedPatchesList.length) {
				selectedIndex = Math.max(0, savedPatchesList.length - 1);
			}
		} catch (error) {
			console.error('Error deleting patch from storage:', error);
		}
	}

	function renamePatch() {
		if (!selectedPatchToRename || !patchName.trim() || patchName === selectedPatchToRename) {
			onCancel();
			return;
		}

		try {
			// Get the patch data from the old name
			const patchData = localStorage.getItem(`patchies-patch-${selectedPatchToRename}`);
			if (!patchData) {
				console.error('Patch data not found for rename');
				onCancel();
				return;
			}

			// Save with new name
			localStorage.setItem(`patchies-patch-${patchName}`, patchData);

			// Remove old patch data
			localStorage.removeItem(`patchies-patch-${selectedPatchToRename}`);

			// Update saved patches list
			const saved = localStorage.getItem('patchies-saved-patches') || '[]';
			let savedPatchesList: string[] = JSON.parse(saved);

			// Replace old name with new name
			const oldIndex = savedPatchesList.indexOf(selectedPatchToRename);
			if (oldIndex !== -1) {
				savedPatchesList[oldIndex] = patchName;
				localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatchesList));

				// Update local state
				savedPatches = savedPatchesList;
			}

			onCancel();
		} catch (error) {
			console.error('Error renaming patch:', error);
			onCancel();
		}
	}

	function saveGeminiApiKey() {
		if (!geminiApiKey.trim()) return;

		localStorage.setItem('gemini-api-key', geminiApiKey.trim());
		onCancel();
	}

	function saveCelestiAiApiKey() {
		if (!celestiaiApiKey.trim()) return;

		localStorage.setItem('celestiai-api-key', celestiaiApiKey.trim());
		onCancel();
	}

	function scrollToSelectedItem() {
		if (!resultsContainer) return;

		const selectedElement = resultsContainer.children[selectedIndex] as HTMLElement;
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

	function handleClickOutside(event: MouseEvent) {
		if (paletteContainer && !paletteContainer.contains(event.target as Node)) {
			onCancel();
		}
	}

	function handleItemClick(index: number) {
		selectedIndex = index;
		handleSelect();
	}

	$effect(() => {
		const maxIndex =
			stage === 'commands'
				? filteredCommands.length - 1
				: stage === 'load-list' || stage === 'delete-list' || stage === 'rename-list'
					? filteredPatches.length - 1
					: 0;
		selectedIndex = Math.min(selectedIndex, Math.max(0, maxIndex));
	});

	$effect(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div
	bind:this={paletteContainer}
	class="absolute z-50 w-80 rounded-lg border border-zinc-600 bg-zinc-900/90 shadow-2xl backdrop-blur-xl"
	style="left: {position.x}px; top: {position.y}px;"
>
	<!-- Search Input -->
	{#if stage === 'commands'}
		<div class="border-b border-zinc-700 p-3">
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Search commands..."
				class="w-full bg-transparent font-mono text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{:else if stage === 'save-name'}
		<div class="border-b border-zinc-700 p-3">
			<div class="mb-2 text-xs text-zinc-400">What is the name of the patch?</div>
			<input
				bind:this={searchInput}
				bind:value={patchName}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Enter patch name..."
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{:else if stage === 'load-list'}
		<div class="border-b border-zinc-700 p-3">
			<div class="mb-2 text-xs text-zinc-400">Select a patch to load:</div>
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Search patches..."
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{:else if stage === 'delete-list'}
		<div class="border-b border-zinc-700 p-3">
			<div class="mb-2 text-xs text-zinc-400">Select a patch to delete:</div>
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Search patches..."
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{:else if stage === 'rename-list'}
		<div class="border-b border-zinc-700 p-3">
			<div class="mb-2 text-xs text-zinc-400">Select a patch to rename:</div>
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Search patches..."
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{:else if stage === 'rename-name'}
		<div class="border-b border-zinc-700 p-3">
			<div class="mb-2 text-xs text-zinc-400">Enter new name for "{selectedPatchToRename}":</div>
			<input
				bind:this={searchInput}
				bind:value={patchName}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Enter new patch name..."
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{:else if stage === 'gemini-api-key'}
		<div class="border-b border-zinc-700 p-3">
			<div class="mb-2 text-xs text-zinc-400">Enter your Google Gemini API key:</div>
			<input
				bind:this={searchInput}
				bind:value={geminiApiKey}
				onkeydown={handleKeydown}
				type="password"
				placeholder="Enter API key..."
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{:else if stage === 'celestiai-api-key'}
		<div class="border-b border-zinc-700 p-3">
			<div class="mb-2 text-xs text-zinc-400">Enter your CelestiAi AI API key:</div>
			<input
				bind:this={searchInput}
				bind:value={celestiaiApiKey}
				onkeydown={handleKeydown}
				type="password"
				placeholder="Enter API key..."
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
			/>
		</div>
	{/if}

	<!-- Results List -->
	<div bind:this={resultsContainer} class="max-h-64 overflow-y-auto">
		{#if stage === 'commands'}
			{#each filteredCommands as command, index}
				<div
					class="cursor-pointer px-3 py-2 {index === selectedIndex
						? 'bg-zinc-600/50'
						: 'hover:bg-zinc-750'}"
					onclick={() => handleItemClick(index)}
					onkeydown={(e) => e.key === 'Enter' && handleItemClick(index)}
					role="button"
					tabindex="-1"
				>
					<div class="font-mono text-sm text-zinc-200">{command.name}</div>
					<div class="text-xs text-zinc-400">{command.description}</div>
				</div>
			{/each}
		{:else if stage === 'save-name'}
			<!-- Show current input preview -->
			{#if patchName.trim()}
				<div class="px-3 py-2 text-xs text-zinc-400">
					Will save as: <span class="text-zinc-200">{patchName}</span>
				</div>
			{/if}
		{:else if stage === 'load-list'}
			{#if filteredPatches.length === 0}
				<div class="px-3 py-2 text-xs text-zinc-400">No saved patches found</div>
			{:else}
				{#each filteredPatches as patch, index}
					<div
						class="cursor-pointer px-3 py-2 {index === selectedIndex
							? 'bg-zinc-600/50'
							: 'hover:bg-zinc-750'}"
						onclick={() => handleItemClick(index)}
						onkeydown={(e) => e.key === 'Enter' && handleItemClick(index)}
						role="button"
						tabindex="-1"
					>
						<div class="font-mono text-sm text-zinc-200">{patch}</div>
					</div>
				{/each}
			{/if}
		{:else if stage === 'delete-list'}
			{#if filteredPatches.length === 0}
				<div class="px-3 py-2 text-xs text-zinc-400">No saved patches found</div>
			{:else}
				{#each filteredPatches as patch, index}
					<div
						class="cursor-pointer px-3 py-2 {index === selectedIndex
							? 'bg-red-800'
							: 'hover:bg-red-900/50'}"
						onclick={() => handleItemClick(index)}
						onkeydown={(e) => e.key === 'Enter' && handleItemClick(index)}
						role="button"
						tabindex="-1"
					>
						<div class="font-mono text-sm text-red-200">{patch}</div>
					</div>
				{/each}
			{/if}
		{:else if stage === 'rename-list'}
			{#if filteredPatches.length === 0}
				<div class="px-3 py-2 text-xs text-zinc-400">No saved patches found</div>
			{:else}
				{#each filteredPatches as patch, index}
					<div
						class="cursor-pointer px-3 py-2 {index === selectedIndex
							? 'bg-blue-800'
							: 'hover:bg-blue-900/50'}"
						onclick={() => handleItemClick(index)}
						onkeydown={(e) => e.key === 'Enter' && handleItemClick(index)}
						role="button"
						tabindex="-1"
					>
						<div class="font-mono text-sm text-blue-200">{patch}</div>
					</div>
				{/each}
			{/if}
		{:else if stage === 'rename-name'}
			<!-- Show current input preview -->
			{#if patchName.trim() && patchName !== selectedPatchToRename}
				<div class="px-3 py-2 text-xs text-zinc-400">
					Will rename "<span class="text-blue-200">{selectedPatchToRename}</span>" to "<span
						class="text-zinc-200">{patchName}</span
					>"
				</div>
			{/if}
		{:else if stage === 'gemini-api-key'}
			<!-- Show current input preview -->
			{#if geminiApiKey.trim()}
				<div class="px-3 py-2 text-xs text-zinc-400">API key will be saved securely</div>
			{/if}
		{:else if stage === 'celestiai-api-key'}
			<!-- Show current input preview -->
			{#if celestiaiApiKey.trim()}
				<div class="px-3 py-2 text-xs text-zinc-400">API key will be saved securely</div>
			{/if}
		{/if}
	</div>

	<!-- Footer -->
	<div class="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
		{#if stage === 'commands'}
			↑↓ Navigate • Enter Select • Esc Cancel
		{:else if stage === 'save-name'}
			Enter Save • Esc Back
		{:else if stage === 'load-list'}
			↑↓ Navigate • Enter Load • Esc Back
		{:else if stage === 'delete-list'}
			↑↓ Navigate • Enter Delete • Esc Back
		{:else if stage === 'rename-list'}
			↑↓ Navigate • Enter Rename • Esc Back
		{:else if stage === 'rename-name'}
			Enter Rename • Esc Back
		{:else if stage === 'gemini-api-key'}
			Enter Save • Esc Back
		{:else if stage === 'celestiai-api-key'}
			Enter Save • Esc Back
		{/if}
	</div>
</div>
