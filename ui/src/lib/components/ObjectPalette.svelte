<script lang="ts">
	import { onMount } from 'svelte';
	import { match } from 'ts-pattern';
	import { PRESETS } from '$lib/presets/presets';
	import { isObjectPaletteVisible } from '../../stores/ui.store';

	interface Props {
		nodeTypes: Record<string, any>;
		position: { x: number; y: number };
		onselect: (nodeType: string, isPreset?: boolean) => void;
		oncancel: () => void;
	}

	let { nodeTypes, position, onselect: onSelect, oncancel: onCancel }: Props = $props();

	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let searchInput: HTMLInputElement;
	let paletteContainer: HTMLDivElement;
	let resultsContainer: HTMLDivElement;

	const allItems = $derived.by(() => {
		return [
			...Object.keys(nodeTypes).map((type) => ({ name: type, isPreset: false })),
			...Object.keys(PRESETS).map((name) => ({ name, isPreset: true }))
		];
	});

	// Combine node types and presets, then filter based on search query
	const filteredItems = $derived.by(() => {
		return !searchQuery.trim()
			? allItems
			: allItems.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
	});

	// Reset selected index when filtered results change
	$effect(() => {
		if (filteredItems.length > 0) {
			selectedIndex = Math.min(selectedIndex, filteredItems.length - 1);
		}
	});

	$effect(() => {
		if ($isObjectPaletteVisible) {
			searchInput?.focus();
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		match(event.key)
			.with('Escape', () => {
				event.preventDefault();
				event.stopPropagation();

				onCancel();
				searchQuery = '';
			})
			.with('Enter', () => {
				event.preventDefault();
				event.stopPropagation();

				if (filteredItems.length > 0) {
					const item = filteredItems[selectedIndex];
					onSelect(item.name, item.isPreset);
				}

				searchQuery = '';
			})
			.with('ArrowDown', () => {
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, allItems.length - 1);
				scrollToSelectedItem();
			})
			.with('ArrowUp', () => {
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				scrollToSelectedItem();
			});
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

<div
	bind:this={paletteContainer}
	class={[
		'absolute z-50 w-64 rounded-lg border border-zinc-600 bg-zinc-900/50 shadow-lg backdrop-blur-xl',
		$isObjectPaletteVisible ? '' : 'hidden'
	]}
	style="left: {position.x}px; top: {position.y}px;"
>
	<!-- Search Input -->
	<div class="border-b border-zinc-700">
		<input
			bind:this={searchInput}
			bind:value={searchQuery}
			type="text"
			placeholder="Search objects..."
			class="w-full rounded px-3 py-3 font-mono text-sm text-zinc-200 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
			onkeydown={handleKeydown}
		/>
	</div>

	<!-- Results List -->
	<div bind:this={resultsContainer} class="max-h-60 overflow-y-auto">
		{#if filteredItems.length === 0}
			<div class="p-3 text-sm italic text-zinc-400">No objects found</div>
		{:else}
			{#each filteredItems as item, index}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="cursor-pointer border-l-2 px-3 py-2 text-sm transition-colors {index ===
					selectedIndex
						? 'border-zinc-400 bg-zinc-700/40 text-zinc-100'
						: 'border-transparent text-zinc-300'}"
					onclick={() => onSelect(item.name, item.isPreset)}
				>
					<span class="font-mono">{item.name}</span>

					{#if item.isPreset}
						<span class="ml-2 text-[10px] text-zinc-500">{PRESETS[item.name].type}</span>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Footer with hint -->
	<div class="border-t border-zinc-700 p-2 text-xs text-zinc-500">
		<span>↑↓ navigate • Enter select • Esc cancel</span>
	</div>
</div>
