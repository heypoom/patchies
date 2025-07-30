<script lang="ts">
	import { Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { GLSLCanvasManager } from '$lib/canvas/GLSLCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import { MessageContext } from '$lib/messages/MessageContext';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { code: string } } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let previewCanvas: HTMLCanvasElement;
	let canvasManager = new GLSLCanvasManager();
	let messageContext: MessageContext;
	let videoSystem: VideoSystem;
	let showEditor = $state(false);

	const code = $derived(data.code || '');

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		videoSystem = VideoSystem.getInstance();

		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			// TODO: video system will use FBOs instead
		});
	});

	onDestroy(() => {
		// TODO: destroy canvas manager

		if (messageContext) {
			messageContext.destroy();
		}

		if (videoSystem) {
			videoSystem.unregisterNode(nodeId);
		}
	});

	function updateShader() {
		canvasManager?.updateCode(code);
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
					<div class="font-mono text-xs font-medium text-zinc-100">glsl.canvas</div>
				</div>

				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={toggleEditor}
					title="Edit code"
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
						width={canvasManager?.width}
						height={canvasManager?.height}
						class="h-64 w-64 rounded-md border border-zinc-600 shadow-lg"
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
