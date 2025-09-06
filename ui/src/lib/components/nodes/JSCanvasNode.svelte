<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { JSCanvasManager } from '$lib/canvas/JSCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';

	let { id: nodeId, data }: { id: string; data: { code: string } } = $props();

	let canvasElement = $state<HTMLCanvasElement | undefined>();
	let glSystem = GLSystem.getInstance();
	let canvasManager: JSCanvasManager | null = null;
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let dragEnabled = $state(true);

	const { updateNodeData } = useSvelteFlow();

	let bitmapFrameId: number;

	async function uploadBitmap() {
		if (canvasElement && glSystem.hasOutgoingVideoConnections(nodeId)) {
			await glSystem.setBitmapSource(nodeId, canvasElement);
		}

		bitmapFrameId = requestAnimationFrame(uploadBitmap);
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		glSystem.upsertNode(nodeId, 'img', {});

		if (canvasElement) {
			canvasManager = new JSCanvasManager(nodeId, canvasElement);
			canvasManager.setupSketch({ code: data.code });

			bitmapFrameId = requestAnimationFrame(uploadBitmap);
		}
	});

	onDestroy(() => {
		cancelAnimationFrame(bitmapFrameId);

		glSystem.removeNode(nodeId);
		canvasManager?.destroy();
		messageContext?.destroy();
	});

	function updateCanvas() {
		// use noDrag() to prevent dragging
		dragEnabled = true;

		if (canvasManager && messageContext) {
			try {
				messageContext.clearTimers();

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
</script>

<CanvasPreviewLayout
	title="js.canvas"
	onrun={updateCanvas}
	{errorMessage}
	bind:previewCanvas={canvasElement}
	nodrag={!dragEnabled}
>
	{#snippet topHandle()}
		<Handle type="target" position={Position.Top} />
		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-0"
			class="!left-8"
			title="Video input"
		/>
	{/snippet}

	{#snippet bottomHandle()}
		<Handle type="source" position={Position.Bottom} />
		<VideoHandle
			type="source"
			position={Position.Bottom}
			id="video-out-0"
			class="!left-8"
			title="Video output"
		/>
	{/snippet}

	{#snippet codeEditor()}
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
	{/snippet}
</CanvasPreviewLayout>
