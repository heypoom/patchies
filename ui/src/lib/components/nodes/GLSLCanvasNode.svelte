<script lang="ts">
	import { Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { match } from 'ts-pattern';
	import type { Message } from '$lib/messages/MessageSystem';
	import { GLSystem } from '$lib/canvas/GLSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data, type }: { id: string; data: { code: string }; type: string } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	const width = $state(200);
	const height = $state(150);

	let glSystem: GLSystem;
	let previewCanvas: HTMLCanvasElement;
	let previewBitmapContext: ImageBitmapRenderingContext;
	let messageContext: MessageContext;

	let showEditor = $state(false);

	const code = $derived(data.code || '');

	function handleMessage(message: Message) {
		match(message.data.type).with('set', () => {
			updateNodeData(nodeId, { ...data, code: message.data.code });
		});
	}

	function updateShader() {
		glSystem.upsertNode(nodeId, type, data);
	}

	onMount(() => {
		previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
		messageContext = new MessageContext(nodeId);

		glSystem = GLSystem.getInstance();
		glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
		glSystem.upsertNode(nodeId, type, data);

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
		}, 10);
	});

	onDestroy(() => {
		messageContext?.destroy();
		glSystem.removeNode(nodeId);

		// Unregister the context if we are still using it.
		if (glSystem.previewCanvasContexts[nodeId] === previewBitmapContext) {
			glSystem.previewCanvasContexts[nodeId] = null;
		}
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">glsl.canvas</div>
				</div>

				<button
					title="Edit code"
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={() => {
						showEditor = !showEditor;
					}}
				>
					<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-0"
					class="!left-17"
					title="Video input iChannel0"
				/>

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-1"
					class="!left-22"
					title="Video input iChannel1"
				/>

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-2"
					class="!left-27"
					title="Video input iChannel2"
				/>

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-3"
					class="!left-32"
					title="Video input iChannel3"
				/>

				<div class="rounded-md bg-zinc-900">
					<canvas
						bind:this={previewCanvas}
						{width}
						{height}
						class="rounded-md"
						data-preview-canvas="true"
					></canvas>
				</div>

				<VideoHandle type="source" position={Position.Bottom} id="video-out" title="Video output" />
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={updateShader} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={code}
					onchange={(newCode) => {
						updateNodeData(nodeId, { ...data, code: newCode });
					}}
					language="glsl"
					placeholder="Write your GLSL fragment shader here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateShader}
				/>
			</div>
		</div>
	{/if}
</div>
