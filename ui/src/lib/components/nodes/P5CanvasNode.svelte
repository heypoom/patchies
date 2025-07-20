<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { P5Manager } from '$lib/p5/P5Manager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let containerElement: HTMLDivElement;
	let p5Manager: P5Manager | null = null;
	let messageContext: MessageContext;
	let videoSystem: VideoSystem;
	let showEditor = $state(false);
	let code = $state(`function setup() {
  createCanvas(200, 200);
}

function draw() {
  background(100, 200, 300);
  fill(255, 255, 100);
  ellipse(100, 100, 80, 80);
}`);

	onMount(() => {
		// Initialize message context and video system
		messageContext = new MessageContext(nodeId);
		videoSystem = VideoSystem.getInstance();

		// Subscribe to video canvas sources
		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			if (p5Manager && canvases.length > 0) {
				// Use the first canvas source
				p5Manager.setVideoCanvas(canvases[0]);
			}
		});

		// Wait a tick to ensure everything is initialized
		setTimeout(() => {
			if (containerElement) {
				p5Manager = new P5Manager(containerElement);
				updateSketch();
				registerVideoSource();
			}
		}, 0);
	});

	onDestroy(() => {
		if (p5Manager) {
			p5Manager.destroy();
		}
		if (messageContext) {
			messageContext.destroy();
		}
		if (videoSystem) {
			videoSystem.unregisterNode(nodeId);
		}
	});

	function updateSketch() {
		if (p5Manager && messageContext) {
			p5Manager.updateCode({
				code,
				messageContext: messageContext.getContext()
			});
			// Re-register video source since P5Manager recreates the p5.js instance
			registerVideoSource();
		}
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}

	function registerVideoSource() {
		if (p5Manager && videoSystem) {
			const canvas = p5Manager.getCanvas();
			if (canvas) {
				videoSystem.registerVideoSource(nodeId, canvas);
			}
		}
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">p5.canvas</div>
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

				<div
					bind:this={containerElement}
					class="rounded-md bg-zinc-900 [&>canvas]:rounded-md"
				></div>

				<Handle type="source" position={Position.Bottom} class="absolute" />
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
				<button onclick={updateSketch} class="p-1 hover:bg-zinc-700">
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					bind:value={code}
					language="javascript"
					placeholder="Write your p5.js code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateSketch}
				/>
			</div>
		</div>
	{/if}
</div>
