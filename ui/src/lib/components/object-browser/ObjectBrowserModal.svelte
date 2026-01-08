<script lang="ts">
	import { ChevronDown, Search, SearchX, X } from '@lucide/svelte/icons';
	import {
		getCategorizedObjects,
		type CategoryGroup,
		type ObjectItem
	} from './get-categorized-objects';
	import Fuse from 'fuse.js';

	let {
		open = $bindable(false),
		onSelectObject
	}: { open?: boolean; onSelectObject: (name: string) => void } = $props();

	let searchQuery = $state('');
	let expandedCategories = $state<Set<string>>(new Set());

	// Get all categorized objects
	const allCategories = getCategorizedObjects();

	// Create Fuse instance for fuzzy search
	const fuse = new Fuse(
		allCategories.flatMap((cat) =>
			cat.objects.map((obj) => ({
				...obj,
				categoryTitle: cat.title
			}))
		),
		{
			keys: ['name', 'description', 'categoryTitle'],
			threshold: 0.3,
			includeScore: true
		}
	);

	// Filtered categories based on search
	const filteredCategories = $derived.by(() => {
		if (!searchQuery.trim()) {
			return allCategories;
		}

		const results = fuse.search(searchQuery);
		const matchedObjects = new Map<string, ObjectItem[]>();

		for (const result of results) {
			const categoryTitle = result.item.categoryTitle;
			if (!matchedObjects.has(categoryTitle)) {
				matchedObjects.set(categoryTitle, []);
			}
			matchedObjects.get(categoryTitle)!.push({
				name: result.item.name,
				description: result.item.description,
				category: result.item.category
			});
		}

		return allCategories
			.map((cat) => ({
				...cat,
				objects: matchedObjects.get(cat.title) || []
			}))
			.filter((cat) => cat.objects.length > 0);
	});

	function handleClose() {
		open = false;
		searchQuery = '';
	}

	function handleSelectObject(name: string) {
		onSelectObject(name);
		handleClose();
	}

	function toggleCategory(title: string) {
		const newExpanded = new Set(expandedCategories);
		if (newExpanded.has(title)) {
			newExpanded.delete(title);
		} else {
			newExpanded.add(title);
		}
		expandedCategories = newExpanded;
	}

	// Initialize with all categories expanded
	$effect(() => {
		if (open && expandedCategories.size === 0) {
			expandedCategories = new Set(allCategories.map((cat) => cat.title));
		}
	});

	// Auto-expand categories when searching
	$effect(() => {
		if (searchQuery.trim() && filteredCategories.length > 0) {
			expandedCategories = new Set(filteredCategories.map((cat) => cat.title));
		} else if (!searchQuery.trim()) {
			// Expand all when search is cleared
			expandedCategories = new Set(allCategories.map((cat) => cat.title));
		}
	});

	// Handle global escape key
	$effect(() => {
		if (!open) return;

		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				handleClose();
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if open}
	<!-- Modal backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center font-sans"
		role="presentation"
		onclick={(e) => {
			// Close if clicking on the backdrop (not the modal content)
			if (e.target === e.currentTarget) {
				handleClose();
			}
		}}
	>
		<!-- Backdrop overlay -->
		<div
			class="pointer-events-none fixed inset-0 bg-black/60 backdrop-blur-sm"
			aria-hidden="true"
		></div>

		<!-- Modal container -->
		<div
			class="relative z-10 flex h-screen w-full flex-col overflow-hidden bg-zinc-950 sm:mx-4 sm:h-[85vh] sm:max-w-4xl sm:rounded-lg sm:border sm:border-zinc-700 sm:shadow-2xl md:mx-8 lg:mx-12"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Header with close button -->
			<div
				class="flex items-center justify-between border-b border-zinc-800 px-4 pt-10 pb-3 sm:px-6 sm:pt-4"
			>
				<h2 id="modal-title" class="text-lg font-medium text-zinc-200">Browse Objects</h2>
				<button
					onclick={handleClose}
					class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
					aria-label="Close modal"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Search bar -->
			<div class="border-b border-zinc-800 px-4 py-3 sm:px-6">
				<div class="relative">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search objects..."
						class="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pr-4 pl-10 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
					/>
					{#if searchQuery}
						<button
							onclick={() => (searchQuery = '')}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
							aria-label="Clear search"
						>
							<X class="h-4 w-4" />
						</button>
					{/if}
				</div>
			</div>

			<!-- Object categories -->
			<div class="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
				{#if filteredCategories.length === 0}
					<div class="flex h-full items-center justify-center text-zinc-500">
						<div class="text-center">
							<SearchX class="mx-auto mb-2 h-12 w-12" />
							<p>No objects found</p>
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						{#each filteredCategories as category (category.title)}
							<div>
								<!-- Category header -->
								<button
									onclick={() => toggleCategory(category.title)}
									class="mb-2 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-900"
								>
									<span class="text-sm font-medium text-zinc-400">
										{category.title}
										<span class="text-zinc-600">({category.objects.length})</span>
									</span>
									<ChevronDown
										class="h-4 w-4 text-zinc-500 transition-transform {expandedCategories.has(
											category.title
										)
											? ''
											: '-rotate-90'}"
									/>
								</button>

								<!-- Category objects grid -->
								{#if expandedCategories.has(category.title)}
									<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
										{#each category.objects as object (object.name)}
											<button
												onclick={() => handleSelectObject(object.name)}
												class="flex cursor-pointer flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
											>
												<span class="font-mono text-sm text-zinc-200">{object.name}</span>
												<span class="line-clamp-2 text-xs text-zinc-500">{object.description}</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Custom scrollbar styling */
	:global(.overflow-y-auto::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-track) {
		background: rgb(39 39 42); /* zinc-800 */
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb) {
		background: rgb(63 63 70); /* zinc-700 */
		border-radius: 4px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: rgb(82 82 91); /* zinc-600 */
	}
</style>
