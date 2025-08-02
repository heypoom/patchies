<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { JSCanvasManager } from '$lib/canvas/JSCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';

	let { id: nodeId, data }: { id: string; data: { code: string } } = $props();

	let canvasElement: HTMLCanvasElement;
	let glSystem = GLSystem.getInstance();
	let canvasManager: JSCanvasManager | null = null;
	let messageContext: MessageContext;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let dragEnabled = $state(true);

	const { updateNodeData } = useSvelteFlow();

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		glSystem.upsertNode(nodeId, 'img', {});
		canvasManager = new JSCanvasManager(nodeId, canvasElement);
		canvasManager.setupSketch({ code: data.code });
	});

	onDestroy(() => {
		glSystem.removeNode(nodeId);
		canvasManager?.destroy();
		messageContext?.destroy();
	});

	function updateCanvas() {
		// use noDrag() to prevent draggingsetupCanvasnabled = true;

		if (canvasManager && messageContext) {
			try {
				messageContext.clearIntervals();

				canvasManager.updateSketch({
					code: data.code,
					messageContext: {
						...messageContext.getContext(),
						noDrag: () => {
							dragEnabled = false;
						}
					}
				});

				errorMessage = null;
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">js.canvas</div>
				</div>

				<button
					class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
					onclick={toggleEditor}
					title="Edit code"
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<Handle type="target" position={Position.Top} />
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in"
					class="!left-8"
					title="Video input"
				/>

				<canvas
					bind:this={canvasElement}
					class={['rounded-md bg-zinc-900 ', dragEnabled ? 'cursor-grab' : 'nodrag cursor-default']}
				></canvas>

				<!-- Error display -->
				{#if errorMessage}
					<div
						class="absolute inset-0 flex items-center justify-center rounded-md bg-red-900/90 p-2"
					>
						<div class="text-center">
							<div class="text-xs font-medium text-red-100">Canvas Error:</div>
							<div class="mt-1 text-xs text-red-200">{errorMessage}</div>
						</div>
					</div>
				{/if}

				<Handle type="source" position={Position.Bottom} />
				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					class="!left-8"
					title="Video output"
				/>
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={updateCanvas} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={data.code}
					language="javascript"
					placeholder="Write your Canvas API code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateCanvas}
					onchange={(newCode) => {
						updateNodeData(nodeId, { ...data, code: newCode });
					}}
				/>
			</div>
		</div>
	{/if}
</div>
