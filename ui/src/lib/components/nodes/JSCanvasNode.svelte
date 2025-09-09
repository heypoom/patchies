<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { JSCanvasManager } from '$lib/canvas/JSCanvasManager';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';

	let {
		id: nodeId,
		data
	}: {
		id: string;
		data: {
			title: string;
			code: string;
			inletCount?: number;
			outletCount?: number;
		};
	} = $props();

	let canvasElement = $state<HTMLCanvasElement | undefined>();
	let glSystem = GLSystem.getInstance();
	let canvasManager: JSCanvasManager | null = null;
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let dragEnabled = $state(true);

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	const [width, height] = glSystem.previewSize;

	let inletCount = $derived(data.inletCount ?? 1);
	let outletCount = $derived(data.outletCount ?? 0);

	let bitmapFrameId: number;

	const setPortCount = (newInletCount = 1, newOutletCount = 0) => {
		updateNodeData(nodeId, { ...data, inletCount: newInletCount, outletCount: newOutletCount });
		updateNodeInternals(nodeId);
	};

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
			updateCanvas();

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

				const context = messageContext.getContext();

				canvasManager.updateSketch({
					code: data.code,
					messageContext: {
						...context,
						noDrag: () => {
							dragEnabled = false;
						},
						setPortCount,

						// @ts-expect-error -- alias for onMessage
						recv: context.onMessage
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
	{width}
	{height}
>
	{#snippet topHandle()}
		{#each Array.from({ length: inletCount }) as _, index}
			<StandardHandle port="inlet" id={index} title={`Inlet ${index}`} total={inletCount} {index} />
		{/each}
	{/snippet}

	{#snippet bottomHandle()}
		<StandardHandle
			port="outlet"
			type="video"
			id={0}
			title="Video output"
			total={outletCount + 1}
			index={outletCount}
		/>

		{#each Array.from({ length: outletCount }) as _, index}
			<StandardHandle
				port="outlet"
				id={index}
				title={`Outlet ${index}`}
				total={outletCount + 1}
				{index}
			/>
		{/each}
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
