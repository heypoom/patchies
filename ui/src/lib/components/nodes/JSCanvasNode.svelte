<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
	import type { NodePortCountUpdateEvent } from '$lib/eventbus/events';

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

	let glSystem = GLSystem.getInstance();
	let audioAnalysisSystem: AudioAnalysisSystem;
	let messageContext: MessageContext;
	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let errorMessage = $state<string | null>(null);
	let dragEnabled = $state(true);

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	const [outputWidth, outputHeight] = glSystem.outputSize;

	let inletCount = $derived(data.inletCount ?? 1);
	let outletCount = $derived(data.outletCount ?? 0);

	// Store event handler for cleanup
	function handlePortCountUpdate(e: NodePortCountUpdateEvent) {
		if (e.nodeId !== nodeId) return;

		match(e)
			.with({ portType: 'message' }, (m) => {
				updateNodeData(nodeId, {
					...data,
					inletCount: m.inletCount,
					outletCount: m.outletCount
				});
				updateNodeInternals(nodeId);
			})
			.otherwise(() => {
				// Handle other port types if needed
			});
	}

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { ...data, code: newCode });
		setTimeout(() => updateCanvas());
	};

	const handleMessage: MessageCallbackFn = (message, meta) => {
		try {
			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, () => {
					updateCanvas();
				})
				.otherwise(() => {
					glSystem.sendMessageToNode(nodeId, { ...meta, data: message });
				});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);
		audioAnalysisSystem = AudioAnalysisSystem.getInstance();

		// Listen for port count updates from the worker
		const eventBus = glSystem.eventBus;
		eventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);

		if (previewCanvas) {
			previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
		}

		glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;

		glSystem.upsertNode(nodeId, 'canvas', { code: data.code });

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
			updateCanvas();
		}, 50);
	});

	onDestroy(() => {
		const eventBus = glSystem?.eventBus;
		if (eventBus) {
			eventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
		}

		audioAnalysisSystem?.disableFFT(nodeId);
		glSystem?.removeNode(nodeId);
		messageContext?.destroy();
	});

	function updateCanvas() {
		try {
			messageContext.clearTimers();
			audioAnalysisSystem.disableFFT(nodeId);
			const isUpdated = glSystem.upsertNode(nodeId, 'canvas', { code: data.code });
			// If the code hasn't changed, the code will not be re-run.
			// This allows us to forcibly re-run canvas to update FFT.
			if (!isUpdated) glSystem.send('updateCanvas', { nodeId });
			errorMessage = null;
		} catch (error) {
			// Capture compilation/setup errors
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}
</script>

<CanvasPreviewLayout
	title={data.title ?? 'canvas'}
	onrun={updateCanvas}
	{errorMessage}
	bind:previewCanvas
	nodrag={!dragEnabled}
	width={outputWidth}
	height={outputHeight}
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
