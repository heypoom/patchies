<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { P5Manager } from '$lib/p5/P5Manager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId, data }: { id: string; data: { code: string } } = $props();
	
	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let containerElement: HTMLDivElement;
	let p5Manager: P5Manager | null = null;
	let messageContext: MessageContext;
	let videoSystem: VideoSystem;
	let showEditor = $state(false);
	let enableDrag = $state(true);
	let errorMessage = $state<string | null>(null);

	const code = $derived(data.code || '');

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
				// Register after a brief delay to ensure p5.js setup is complete
				setTimeout(() => {
					registerVideoSource();
				}, 100);
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
		// re-enable drag on update. nodrag() must be called on setup().
		enableDrag = true;

		if (p5Manager && messageContext) {
			try {
				p5Manager.updateCode({
					code,
					messageContext: {
						...messageContext.getContext(),
						noDrag: () => {
							enableDrag = false;
						}
					}
				});
				// Clear any previous errors on successful update
				errorMessage = null;
				// Re-register video source after p5.js recreates canvas
				setTimeout(() => {
					registerVideoSource();
				}, 100);
			} catch (error) {
				// Capture compilation/setup errors
				errorMessage = error instanceof Error ? error.message : String(error);
			}
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
			} else {
				console.warn(`No canvas available for P5 node ${nodeId} during registration`);
			}
		}
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-transparent px-2 py-1">
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
				<Handle type="target" position={Position.Top} class="z-1" />

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in"
					class="!left-20 z-1"
					title="Video input"
				/>

				<div class="relative">
					<div
						bind:this={containerElement}
						class={[
							'min-h-[100px] min-w-[100px] rounded-md bg-transparent [&>canvas]:rounded-md',
							enableDrag ? 'cursor-grab' : 'nodrag cursor-default'
						]}
					></div>

					<!-- Error display -->
					{#if errorMessage}
						<div
							class="absolute inset-0 flex items-center justify-center rounded-md bg-red-900/90 p-2"
						>
							<div class="text-center">
								<div class="mt-1 text-xs text-red-200">{errorMessage}</div>
							</div>
						</div>
					{/if}
				</div>

				<Handle type="source" position={Position.Bottom} class="absolute" />

				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					class="!left-20 z-1"
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

			<div class="rounded-lg border border-zinc-600 bg-transparent shadow-xl">
				<CodeEditor
					value={code}
					onchange={(newCode) => {
						updateNodeData(nodeId, { ...data, code: newCode });
					}}
					language="javascript"
					placeholder="Write your p5.js code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateSketch}
				/>
			</div>
		</div>
	{/if}
</div>
