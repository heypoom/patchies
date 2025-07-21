<script lang="ts">
	import { onMount } from 'svelte';
	import { match, P } from 'ts-pattern';

	interface Props {
		position: { x: number; y: number };
		onCancel: () => void;
	}

	let { position, onCancel }: Props = $props();

	// Component state
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let searchInput: HTMLInputElement | undefined = $state();
	let paletteContainer: HTMLDivElement | undefined = $state();

	// Multi-stage state
	let stage = $state<'commands' | 'save-name' | 'load-list'>('commands');
	let patchName = $state('');
	let savedPatches = $state<string[]>([]);

	// Base commands for stage 1
	const commands = [
		{ id: 'save-file', name: 'Save to File', description: 'Save patch as JSON file' },
		{ id: 'load-file', name: 'Load from File', description: 'Load patch from JSON file' },
		{ id: 'save', name: 'Save', description: 'Save patch to local storage' },
		{ id: 'load', name: 'Load', description: 'Load patch from local storage' }
	];

	// Filtered items based on current stage
	const filteredCommands = $derived.by(() => {
		return commands.filter(
			(cmd) =>
				cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
		);
	});

	const filteredPatches = $derived.by(() => {
		return savedPatches.filter((patch) => patch.toLowerCase().includes(searchQuery.toLowerCase()));
	});

	// Auto-focus search input
	onMount(() => {
		searchInput?.focus();
		loadSavedPatches();
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
						: stage === 'load-list'
							? filteredPatches.length - 1
							: 0;
				selectedIndex = Math.min(selectedIndex + 1, maxIndex);
			})
			.with('ArrowUp', () => {
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
			})
			.with('Enter', () => {
				event.preventDefault();
				handleSelect();
			})
			.otherwise(() => {});
	}

	function handleSelect() {
		if (stage === 'commands' && filteredCommands.length > 0) {
			const selectedCommand = filteredCommands[selectedIndex];
			executeCommand(selectedCommand.id);
		} else if (stage === 'save-name' && patchName.trim()) {
			saveToLocalStorage();
		} else if (stage === 'load-list' && filteredPatches.length > 0) {
			const selectedPatch = filteredPatches[selectedIndex];
			loadFromLocalStorage(selectedPatch);
		}
	}

	function executeCommand(commandId: string) {
		switch (commandId) {
			case 'save-file':
				saveToFile();
				break;
			case 'load-file':
				loadFromFile();
				break;
			case 'save':
				stage = 'save-name';
				searchQuery = '';
				patchName = '';
				selectedIndex = 0;
				break;
			case 'load':
				stage = 'load-list';
				searchQuery = '';
				selectedIndex = 0;
				break;
		}
	}

	function saveToFile() {
		// TODO: Implement serialization logic
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `patch-${timestamp}.json`;

		// Placeholder - will implement actual serialization in step 2
		const patchData = { placeholder: 'patch data' };

		const blob = new Blob([JSON.stringify(patchData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
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
						// TODO: Implement deserialization logic
						console.log('Loading patch:', patchData);
						onCancel();
					} catch (error) {
						console.error('Error loading patch:', error);
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
		onCancel();
	}

	function saveToLocalStorage() {
		if (!patchName.trim()) return;

		// TODO: Implement serialization logic
		const patchData = { placeholder: 'patch data' };

		const saved = localStorage.getItem('patchies-saved-patches') || '[]';
		let savedPatches: string[];
		try {
			savedPatches = JSON.parse(saved);
		} catch (e) {
			savedPatches = [];
		}

		if (!savedPatches.includes(patchName)) {
			savedPatches.push(patchName);
			localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatches));
		}

		localStorage.setItem(`patchies-patch-${patchName}`, JSON.stringify(patchData));
		onCancel();
	}

	function loadFromLocalStorage(patchName: string) {
		const patchData = localStorage.getItem(`patchies-patch-${patchName}`);
		if (patchData) {
			try {
				const data = JSON.parse(patchData);
				// TODO: Implement deserialization logic
				console.log('Loading patch from storage:', data);
				onCancel();
			} catch (error) {
				console.error('Error loading patch from storage:', error);
			}
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
				: stage === 'load-list'
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
	class="absolute z-50 w-80 rounded-lg border border-zinc-600 bg-zinc-800 shadow-2xl"
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
				class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-400 outline-none"
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
	{/if}

	<!-- Results List -->
	<div class="max-h-64 overflow-y-auto">
		{#if stage === 'commands'}
			{#each filteredCommands as command, index}
				<div
					class="cursor-pointer px-3 py-2 {index === selectedIndex
						? 'bg-zinc-700'
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
							? 'bg-zinc-700'
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
		{/if}
	</div>
</div>
