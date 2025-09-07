<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { JSCanvasManager } from '$lib/canvas/JSCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';

	let { id: nodeId, data }: { id: string; data: { title: string; code: string } } = $props();

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
	title={data.title ?? 'canvas'}
	onrun={updateCanvas}
	{errorMessage}
	bind:previewCanvas={canvasElement}
	nodrag={!dragEnabled}
>
	{#snippet topHandle()}
		<StandardHandle port="inlet" type="message" total={2} index={0} />
		<StandardHandle port="inlet" type="video" id="0" title="Video input" total={2} index={1} />
	{/snippet}

	{#snippet bottomHandle()}
		<StandardHandle port="outlet" type="message" total={2} index={0} />
		<StandardHandle port="outlet" type="video" id="0" title="Video output" total={2} index={1} />
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
