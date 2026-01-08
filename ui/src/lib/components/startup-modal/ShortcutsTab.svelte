<script lang="ts">
	import { Info, Keyboard, MousePointer } from '@lucide/svelte/icons';

	interface Shortcut {
		keys: string[];
		description: string;
		category: 'mouse' | 'keyboard';
	}

	const shortcuts: Shortcut[] = [
		// Mouse shortcuts
		{
			keys: ['Click on object / title'],
			description: 'Focus on the object',
			category: 'mouse'
		},
		{
			keys: ['Drag on object / title'],
			description: 'Move the object around',
			category: 'mouse'
		},
		{
			keys: ['Scroll up'],
			description: 'Zoom in',
			category: 'mouse'
		},
		{
			keys: ['Scroll down'],
			description: 'Zoom out',
			category: 'mouse'
		},
		{
			keys: ['Drag on empty space'],
			description: 'Pan the canvas',
			category: 'mouse'
		},
		{
			keys: ['Shift', 'Drag on empty space'],
			description: 'Select multiple objects',
			category: 'mouse'
		},
		// Keyboard shortcuts
		{
			keys: ['Enter'],
			description: 'Create a new object at cursor position',
			category: 'keyboard'
		},
		{
			keys: ['Ctrl', 'K'],
			description: 'Open the command palette to search for commands',
			category: 'keyboard'
		},
		{
			keys: ['Ctrl', 'B'],
			description: 'Browse all objects with search and categories',
			category: 'keyboard'
		},
		{
			keys: ['Ctrl', 'I'],
			description: 'AI-powered object insertion/editing - create new objects or modify selected ones',
			category: 'keyboard'
		},
		{
			keys: ['Ctrl', 'S'],
			description: 'Manually save patch to browser storage',
			category: 'keyboard'
		},
		{
			keys: ['Shift', 'Enter'],
			description: 'Run the code in the code editor within the selected object',
			category: 'keyboard'
		},
		{
			keys: ['Delete'],
			description: 'Delete the selected object',
			category: 'keyboard'
		},
		{
			keys: ['Ctrl', 'C'],
			description: 'Copy the selected object',
			category: 'keyboard'
		},
		{
			keys: ['Ctrl', 'V'],
			description: 'Paste the copied object',
			category: 'keyboard'
		}
	];

	const mouseShortcuts = shortcuts.filter((s) => s.category === 'mouse');
	const keyboardShortcuts = shortcuts.filter((s) => s.category === 'keyboard');
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-zinc-100">Keyboard and Mouse Shortcuts</h1>
		<p class="mt-1 text-sm text-zinc-400">
			Quick reference for navigating and working with Patchies
		</p>
	</div>

	<!-- Mouse Shortcuts -->
	<div class="space-y-3">
		<h2 class="flex items-center gap-2 text-lg font-semibold text-zinc-200">
			<MousePointer class="h-5 w-5 text-orange-500" />
			Mouse Shortcuts
		</h2>
		<div class="space-y-2">
			{#each mouseShortcuts as shortcut}
				<div
					class="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
				>
					<span class="text-sm text-zinc-300">{shortcut.description}</span>
					<div class="flex gap-1.5">
						{#each shortcut.keys as key}
							<kbd class="rounded bg-zinc-700 px-2 py-1 font-mono text-xs text-zinc-200">{key}</kbd>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Keyboard Shortcuts -->
	<div class="space-y-3">
		<h2 class="flex items-center gap-2 text-lg font-semibold text-zinc-200">
			<Keyboard class="h-5 w-5 text-orange-500" />
			Keyboard Shortcuts
		</h2>
		<div class="space-y-2">
			{#each keyboardShortcuts as shortcut}
				<div
					class="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
				>
					<span class="text-sm text-zinc-300">{shortcut.description}</span>
					<div class="flex gap-1.5">
						{#each shortcut.keys as key}
							<kbd class="rounded bg-zinc-700 px-2 py-1 font-mono text-xs text-zinc-200">{key}</kbd>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Additional note -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<div class="flex items-start gap-2">
			<Info class="mt-0.5 h-4 w-4 text-blue-400" />
			<p class="text-sm text-zinc-300">
				On macOS, use <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Cmd</kbd>
				instead of <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd>
			</p>
		</div>
	</div>
</div>
