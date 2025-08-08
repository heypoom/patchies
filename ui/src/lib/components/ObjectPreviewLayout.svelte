<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Snippet } from 'svelte';
	import * as Tooltip from './ui/tooltip';

	let {
		title,
		onrun,
		onPlaybackToggle,
		paused = false,
		showPauseButton = false,

		topHandle,
		bottomHandle,
		preview,
		codeEditor
	}: {
		title: string;
		onrun?: () => void;
		onPlaybackToggle?: () => void;
		paused?: boolean;
		showPauseButton?: boolean;

		topHandle?: Snippet;
		bottomHandle?: Snippet;
		preview?: Snippet;
		codeEditor: Snippet;
	} = $props();

	let showEditor = $state(false);

	function handlePlaybackToggle() {
		onPlaybackToggle?.();
	}

	function handleRun() {
		onrun?.();
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">{title}</div>
				</div>

				<div class="flex gap-1">
					{#if showPauseButton}
						<button
							title={paused ? 'Resume' : 'Pause'}
							class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
							onclick={handlePlaybackToggle}
						>
							<Icon icon={paused ? 'lucide:play' : 'lucide:pause'} class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}

					<button
						class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
						onclick={() => {
							showEditor = !showEditor;
						}}
						title="Edit code"
					>
						<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				{@render topHandle?.()}
				{@render preview?.()}
				{@render bottomHandle?.()}
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				{#if onrun}
					<Tooltip.Root>
						<Tooltip.Trigger>
							<button onclick={handleRun} class="rounded p-1 hover:bg-zinc-700">
								<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Run Code (shift+enter)</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				{@render codeEditor()}
			</div>
		</div>
	{/if}
</div>
