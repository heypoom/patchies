<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import Icon from '@iconify/svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const shortcuts = [
		{
			category: 'Navigation',
			items: [
				{ key: 'N', description: 'Search for an object to insert at cursor' },
				{ key: 'Enter', description: 'Insert an empty object at cursor' },
				{ key: 'Cmd + K', description: 'Open command palette' }
			]
		},
		{
			category: 'Code Editing',
			items: [{ key: 'Shift + Enter', description: 'Run code in editor' }]
		}
	];

	const resources = [
		{
			name: 'How to use',
			url: 'https://github.com/heypoom/patchies/blob/main/README.md'
		},
		{
			name: 'GitHub',
			url: 'https://github.com/heypoom/patchies'
		}
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class="rounded p-1 hover:bg-zinc-700" title="Keyboard shortcuts">
		<Icon icon="lucide:help-circle" class="h-4 w-4 text-zinc-300" />
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Quickstart</Dialog.Title>
			<Dialog.Description>Keyboard shortcuts and helpful links</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			{#each shortcuts as category}
				<div>
					<h3 class="mb-2 text-sm font-medium text-zinc-200">{category.category}</h3>
					<div class="space-y-2">
						{#each category.items as shortcut}
							<div class="flex items-center justify-between">
								<span class="text-sm text-zinc-400">{shortcut.description}</span>
								<kbd
									class="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-300"
								>
									{shortcut.key}
								</kbd>
							</div>
						{/each}
					</div>
				</div>
			{/each}

			<div>
				<h3 class="mb-3 text-sm font-medium text-zinc-200">Resources</h3>

				<ul class="list-inside list-disc">
					{#each resources as resource}
						<li>
							<a
								href={resource.url}
								target="_blank"
								rel="noopener noreferrer"
								class="text-sm text-blue-400 hover:underline"
							>
								{resource.name}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
