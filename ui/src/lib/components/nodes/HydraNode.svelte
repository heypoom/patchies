<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { HydraManager } from '$lib/hydra/HydraManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { VideoSystem } from '$lib/video/VideoSystem';
	import type { Message } from '$lib/messages/MessageSystem';

	// Get node data from XY Flow - nodes receive their data as props
	let {
		id: nodeId,
		data,
		selected
	}: { id: string; data: { code: string }; selected: boolean } = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	let containerElement: HTMLDivElement;
	let hydraManager: HydraManager | null = null;
	let messageContext: MessageContext;
	let videoSystem: VideoSystem;
	let showEditor = $state(false);
	let errorMessage = $state<string | null>(null);

	const code = $derived(data.code || '');

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { ...data, code: newCode });
		setTimeout(() => updateHydra());
	};

	function handleMessageNodeCallback(message: Message) {
		if (message.data.type === 'set') {
			setCodeAndUpdate(message.data.code);
		} else if (message.data.type === 'run') {
			updateHydra();
		}
	}

	onMount(() => {
		// Initialize message context and video system
		messageContext = new MessageContext(nodeId);
		videoSystem = VideoSystem.getInstance();

		// Subscribe to video canvas sources
		videoSystem.onVideoCanvas(nodeId, (canvases) => {
			if (hydraManager) {
				hydraManager.setVideoCanvases(canvases);
			}
		});

		messageContext.queue.addCallback(handleMessageNodeCallback);

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
					class="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
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
					class="!left-16 z-1"
					title="Video input 0"
				/>

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-1"
					class="!left-20 z-1"
					title="Video input 1"
				/>

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-2"
					class="!left-24 z-1"
					title="Video input 2"
				/>

				<VideoHandle
					type="target"
					position={Position.Top}
					id="video-in-3"
					class="!left-28 z-1"
					title="Video input 3"
				/>

				<Handle
					type="target"
					position={Position.Top}
					class="!left-32 z-1"
					id="message-in"
					title="Message input"
				/>

				<div
					bind:this={containerElement}
					class={[
						'min-h-[200px] min-w-[200px] rounded-md border bg-zinc-900',
						selected
							? 'border-zinc-200 [&>canvas]:rounded-[7px]'
							: 'border-transparent [&>canvas]:rounded-md'
					]}
				></div>

				<!-- Error display -->
				{#if errorMessage}
					<div
						class="absolute inset-0 flex items-center justify-center rounded-md bg-red-900/90 p-2"
					>
						<div class="text-center">
							<div class="text-xs font-medium text-red-100">Hydra Error:</div>
							<div class="mt-1 text-xs text-red-200">{errorMessage}</div>
						</div>
					</div>
				{/if}

				<VideoHandle
					type="source"
					position={Position.Bottom}
					id="video-out"
					class="!left-22 z-1"
					title="Video output"
				/>

				<Handle
					type="source"
					position={Position.Bottom}
					id="message-out"
					title="Message output"
					class="!left-28 z-1"
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
					value={code}
					onchange={(newCode) => {
						updateNodeData(nodeId, { ...data, code: newCode });
					}}
					language="javascript"
					placeholder="Write your Hydra code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={updateHydra}
				/>
			</div>
		</div>
	{/if}
</div>
