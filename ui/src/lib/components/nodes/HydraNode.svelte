<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { HydraManager } from '$lib/hydra/HydraManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let { id: nodeId }: { id: string } = $props();

	let containerElement: HTMLDivElement;
	let hydraManager: HydraManager | null = null;
	let messageContext: MessageContext;
	let videoSystem: VideoSystem;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);
	let code = $state(`osc(20, 0.1, 0.8)
  .diff(osc(20, 0.05)
  .rotate(Math.PI/2))
  .out()`);

	onMount(() => {
		// Initialize message context and video system
		messageContext = new MessageContext(nodeId);
		videoSystem = VideoSystem.getInstance();

		// Subscribe to video canvas sources
		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			if (hydraManager && canvases.length > 0) {
				hydraManager.setVideoCanvas(canvases[0]);
			}
		});

		if (containerElement) {
			hydraManager = new HydraManager(containerElement, {
				code,
				messageContext: messageContext.getContext()
			});
			registerVideoSource();
		}
	});

	onDestroy(() => {
		if (hydraManager) {
			hydraManager.destroy();
		}
		if (messageContext) {
			messageContext.destroy();
		}
		if (videoSystem) {
			videoSystem.unregisterNode(nodeId);
		}
	});

	function updateHydra() {
		if (hydraManager && messageContext) {
			try {
				// Clear intervals to avoid duplicates
				messageContext.clearIntervals();
				hydraManager.updateCode({
					code,
					messageContext: messageContext.getContext()
				});
				// Clear any previous errors on successful update
				errorMessage = null;
				// Re-register video source to ensure stream is current
				registerVideoSource();
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
		if (hydraManager && videoSystem) {
			const canvas = hydraManager.getCanvas();
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
					<div class="font-mono text-xs font-medium text-zinc-100">hydra</div>
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
					class="min-h-[200px] min-w-[200px] rounded-md bg-zinc-900 [&>canvas]:rounded-md"
				></div>

				<!-- Error display -->
				{#if errorMessage}
					<div class="absolute inset-0 flex items-center justify-center rounded-md bg-red-900/90 p-2">
						<div class="text-center">
							<div class="text-xs font-medium text-red-100">Hydra Error:</div>
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
				<button onclick={updateHydra} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					bind:value={code}
					language="javascript"
					placeholder="Write your Hydra code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateHydra}
				/>
			</div>
		</div>
	{/if}
</div>
