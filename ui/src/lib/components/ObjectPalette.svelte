<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { match } from 'ts-pattern';

	interface Props {
		nodeTypes: Record<string, any>;
		position: { x: number; y: number };
		onSelect: (nodeType: string) => void;
		onCancel: () => void;
	}

	let { nodeTypes, position, onSelect, onCancel }: Props = $props();

	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let searchInput: HTMLInputElement;
	let paletteContainer: HTMLDivElement;

	// Filter node types based on search query
	const filteredNodeTypes = $derived.by(() => {
		const types = Object.keys(nodeTypes);
		if (!searchQuery.trim()) {
			return types;
		}
		return types.filter((type) => type.toLowerCase().includes(searchQuery.toLowerCase()));
	});

	// Reset selected index when filtered results change
	$effect(() => {
		const filtered = filteredNodeTypes;
		if (filtered.length > 0) {
			selectedIndex = Math.min(selectedIndex, filtered.length - 1);
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		match(event.key)
			.with('Escape', () => {
				event.preventDefault();
				onCancel();
			})
			.with('Enter', () => {
				event.preventDefault();
				const filtered = filteredNodeTypes;
				if (filtered.length > 0) {
					onSelect(filtered[selectedIndex]);
				}
			})
			.with('ArrowDown', () => {
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredNodeTypes.length - 1);
			})
			.with('ArrowUp', () => {
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
			});
	}

	function handleItemClick(nodeType: string) {
		onSelect(nodeType);
	}

	onMount(async () => {
		await tick();
		searchInput?.focus();
	});

	// Close palette when clicking outside
	function handleOutsideClick(event: MouseEvent) {
		if (paletteContainer && !paletteContainer.contains(event.target as Node)) {
			onCancel();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleOutsideClick);
		return () => {
			document.removeEventListener('click', handleOutsideClick);
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={paletteContainer}
	class="absolute z-50 w-64 rounded-lg border border-zinc-600 bg-zinc-800 shadow-lg"
	style="left: {position.x}px; top: {position.y}px;"
	onkeydown={handleKeydown}
>
	<!-- Search Input -->
	<div class="border-b border-zinc-700 p-3">
		<input
			bind:this={searchInput}
			bind:value={searchQuery}
			type="text"
			placeholder="Search objects..."
			class="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
		/>
	</div>

	<!-- Results List -->
	<div class="max-h-60 overflow-y-auto">
		{#if filteredNodeTypes.length === 0}
			<div class="p-3 text-sm text-zinc-400 italic">No objects found</div>
		{:else}
			{#each filteredNodeTypes as nodeType, index}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="cursor-pointer border-l-2 px-3 py-2 text-sm transition-colors {index ===
					selectedIndex
						? 'border-zinc-400 bg-zinc-700 text-zinc-100'
						: 'border-transparent text-zinc-300 hover:bg-zinc-700'}"
					onclick={() => handleItemClick(nodeType)}
				>
					<span class="font-mono">{nodeType}</span>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Footer with hint -->
	<div class="border-t border-zinc-700 p-2 text-xs text-zinc-500">
		<span>↑↓ navigate • Enter select • Esc cancel</span>
	</div>
</div>
