<script lang="ts">
	import { Code, Pause, Play, X, Terminal } from '@lucide/svelte/icons';
	import { onMount, type Snippet } from 'svelte';
	import * as Tooltip from './ui/tooltip';
	import { derived } from 'svelte/store';
	import { useSvelteFlow } from '@xyflow/svelte';

	let previewContainer: HTMLDivElement | null = null;
	const { getNode, updateNodeData } = useSvelteFlow();

	let {
		title,
		nodeId,
		onrun,
		onPlaybackToggle,
		paused = false,
		showPauseButton = false,
		showConsoleButton = false,

		topHandle,
		bottomHandle,
		preview,
		previewWidth,
		codeEditor,
		editorReady
	}: {
		title: string;
		nodeId?: string;
		onrun?: () => void;
		onPlaybackToggle?: () => void;
		paused?: boolean;
		showPauseButton?: boolean;
		showConsoleButton?: boolean;

		topHandle?: Snippet;
		bottomHandle?: Snippet;
		preview?: Snippet;
		codeEditor: Snippet;
		editorReady?: boolean;

		previewWidth?: number;
	} = $props();

	const editorGap = 10;

	let showEditor = $state(false);
	let previewContainerWidth = $state(0);

	function measureContainerWidth() {
		if (previewContainer) {
			previewContainerWidth = previewContainer.clientWidth;
		}
	}

	function handlePlaybackToggle() {
		onPlaybackToggle?.();
	}

	function handleRun() {
		onrun?.();
		measureContainerWidth();
	}

	function handleConsoleToggle() {
		if (nodeId) {
			const node = getNode(nodeId);
			if (node) {
				const newShowConsole = !node.data.showConsole;
				updateNodeData(nodeId, { ...node.data, showConsole: newShowConsole });
			}
		}
	}

	onMount(() => {
		measureContainerWidth();
	});

	let editorLeftPos = $derived.by(() => {
		return (previewWidth ?? previewContainerWidth) + editorGap;
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-lg">
					<div class="font-mono text-xs font-medium text-zinc-400">{title}</div>
				</div>

				<div class="flex gap-1">
					{#if showPauseButton}
						<button
							title={paused ? 'Resume' : 'Pause'}
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={handlePlaybackToggle}
						>
							{#if paused}
								<Play class="h-4 w-4 text-zinc-300" />
							{:else}
								<Pause class="h-4 w-4 text-zinc-300" />
							{/if}
						</button>
					{/if}

					{#if showConsoleButton}
						<button
							title="Toggle console"
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={handleConsoleToggle}
						>
							<Terminal class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}

					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={() => {
							showEditor = !showEditor;
							measureContainerWidth();
						}}
						title="Edit code"
					>
						<Code class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				{@render topHandle?.()}
				<div bind:this={previewContainer}>{@render preview?.()}</div>
				{@render bottomHandle?.()}
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="absolute" style="left: {editorLeftPos}px;">
			{#if editorReady !== false}
				<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
					{#if onrun}
						<Tooltip.Root>
							<Tooltip.Trigger>
								<button onclick={handleRun} class="rounded p-1 hover:bg-zinc-700">
									<Play class="h-4 w-4 text-zinc-300" />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>Run Code (shift+enter)</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
						<X class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			{/if}

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				{@render codeEditor()}
			</div>
		</div>
	{/if}
</div>
