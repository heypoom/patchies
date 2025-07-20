<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Icon from '@iconify/svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const shortcuts = [
		{
			category: "Navigation",
			items: [
				{ key: "N", description: "Create new node at cursor position" }
			]
		},
		{
			category: "Code Editing", 
			items: [
				{ key: "Shift + Enter", description: "Run code in editor" }
			]
		}
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class="rounded p-1 hover:bg-zinc-700" title="Keyboard shortcuts">
		<Icon icon="lucide:help-circle" class="h-4 w-4 text-zinc-300" />
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Keyboard Shortcuts</Dialog.Title>
			<Dialog.Description>
				Quick reference for available keyboard shortcuts
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4">
			{#each shortcuts as category}
				<div>
					<h3 class="text-sm font-medium text-zinc-200 mb-2">{category.category}</h3>
					<div class="space-y-2">
						{#each category.items as shortcut}
							<div class="flex items-center justify-between">
								<span class="text-sm text-zinc-400">{shortcut.description}</span>
								<kbd class="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded font-mono text-zinc-300">
									{shortcut.key}
								</kbd>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>