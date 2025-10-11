<script lang="ts">
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import ExampleCard from './ExampleCard.svelte';
	import type { ExampleCategory } from './types';

	let exampleCategories = $state<ExampleCategory[]>([]);
	let isLoadingExamples = $state(false);

	onMount(async () => {
		// Load example patches from static JSON file
		try {
			isLoadingExamples = true;
			const response = await fetch('/example-patches.json');
			const data = await response.json();

			// Group patches by category
			const categoryMap = new Map<string, ExampleCategory['patches']>();
			for (const patch of data.patches || []) {
				const category = patch.category || 'Uncategorized';
				if (!categoryMap.has(category)) {
					categoryMap.set(category, []);
				}
				categoryMap.get(category)!.push(patch);
			}

			// Convert to array format
			exampleCategories = Array.from(categoryMap.entries()).map(([name, patches]) => ({
				name,
				patches
			}));
		} catch (error) {
			console.error('Failed to load example patches:', error);
		} finally {
			isLoadingExamples = false;
		}
	});

	function loadExample(patchId: string) {
		// Navigate to the example patch
		window.location.href = `/?patch=${patchId}`;
	}
</script>

<div class="space-y-6">
	{#if isLoadingExamples}
		<div class="flex items-center justify-center py-12">
			<Icon icon="lucide:loader-2" class="h-8 w-8 animate-spin text-zinc-500" />
		</div>
	{:else if exampleCategories.length === 0}
		<div class="py-12 text-center text-zinc-500">
			<Icon icon="lucide:folder-open" class="mx-auto mb-3 h-12 w-12" />
			<p>No example patches available</p>
		</div>
	{:else}
		{#each exampleCategories as category}
			<div>
				<h2 class="mb-3 text-lg font-semibold text-zinc-200">{category.name}</h2>
				<div class="grid grid-cols-2 gap-4">
					{#each category.patches as patch}
						<ExampleCard {patch} onLoad={loadExample} />
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
