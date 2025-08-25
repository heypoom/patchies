<script lang="ts">
	import { Handle, Position, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import VideoHandle from '$lib/components/VideoHandle.svelte';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
	import { getPortPosition } from '$lib/utils/node-utils';
	import type { NodePortCountUpdateEvent } from '$lib/eventbus/events';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		type: string;
		data: {
			code: string;
			inletCount?: number;
			outletCount?: number;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let glSystem: GLSystem;
	let audioAnalysisSystem: AudioAnalysisSystem;
	let messageContext: MessageContext;
	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let isPaused = $state(false);
	let errorMessage = $state<string | null>(null);

	// Store event handler for cleanup
	function handlePortCountUpdate(e: NodePortCountUpdateEvent) {
		if (e.nodeId !== nodeId) return;

		updateNodeData(nodeId, {
			...data,
			inletCount: e.inletCount,
			outletCount: e.outletCount
		});

		updateNodeInternals(nodeId);
	}

	const code = $derived(data.code || '');
	let inletCount = $derived(data.inletCount ?? 1);
	let outletCount = $derived(data.outletCount ?? 1);

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { ...data, code: newCode });
		setTimeout(() => updateHydra());
	};

	const handleMessage: MessageCallbackFn = (message, meta) => {
		try {
			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, () => {
					updateHydra();
				})
				.otherwise(() => {
					glSystem.sendMessageToNode(nodeId, { ...meta, data: message });
				});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	onMount(() => {
		glSystem = GLSystem.getInstance();
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);
		audioAnalysisSystem = AudioAnalysisSystem.getInstance();

		// Listen for port count updates from the worker
		const eventBus = glSystem.eventBus;

		eventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);

		if (previewCanvas) {
			previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;

			const [previewWidth, previewHeight] = glSystem.previewSize;
			previewCanvas.width = previewWidth;
			previewCanvas.height = previewHeight;
		}

		glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
		glSystem.upsertNode(nodeId, 'hydra', { code });

		setTimeout(() => {
			glSystem.setPreviewEnabled(nodeId, true);
		}, 10);
	});

	onDestroy(() => {
		messageContext.destroy();
		glSystem.removeNode(nodeId);
		glSystem.removePreviewContext(nodeId, previewBitmapContext);

		// Clean up event listener
		if (handlePortCountUpdate) {
			const eventBus = glSystem.eventBus;
			eventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
		}
	});

	function updateHydra() {
		try {
			messageContext.clearIntervals();
			audioAnalysisSystem.disableFFT(nodeId);

			const isUpdated = glSystem.upsertNode(nodeId, 'hydra', { code });

			// If the code hasn't changed, the code will not be re-run.
			// This allows us to forcibly re-run hydra to update FFT.
			if (!isUpdated) glSystem.send('updateHydra', { nodeId });

			errorMessage = null;
		} catch (error) {
			// Capture compilation/setup errors
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function togglePause() {
		isPaused = !isPaused;
		glSystem.toggleNodePause(nodeId);
	}
</script>

<CanvasPreviewLayout
	title="hydra"
	onrun={updateHydra}
	onPlaybackToggle={togglePause}
	paused={isPaused}
	showPauseButton={true}
	{selected}
	{errorMessage}
	bind:previewCanvas
>
	{#snippet topHandle()}
		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-0"
			style={`left: ${getPortPosition(inletCount + 4, 0)}`}
			title="Video input 0"
			class="z-1"
		/>

		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-1"
			style={`left: ${getPortPosition(inletCount + 4, 1)}`}
			title="Video input 1"
			class="z-1"
		/>

		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-2"
			style={`left: ${getPortPosition(inletCount + 4, 2)}`}
			title="Video input 2"
			class="z-1"
		/>

		<VideoHandle
			type="target"
			position={Position.Top}
			id="video-in-3"
			style={`left: ${getPortPosition(inletCount + 4, 3)}`}
			title="Video input 3"
			class="z-1"
		/>

		{#each Array.from({ length: inletCount }) as _, index}
			<Handle
				type="target"
				id={`in-${index}`}
				position={Position.Top}
				style={`left: ${getPortPosition(inletCount + 4, index + 4)}`}
				title={`Inlet ${index}`}
				class="z-1"
			/>
		{/each}
	{/snippet}

	{#snippet bottomHandle()}
		<VideoHandle
			type="source"
			position={Position.Bottom}
			id="video-out"
			style={`left: ${getPortPosition(outletCount + 1, 0)}`}
			title="Video output"
			class="z-1"
		/>

		{#each Array.from({ length: outletCount }) as _, index}
			<Handle
				type="source"
				id={`out-${index}`}
				position={Position.Bottom}
				style={`left: ${getPortPosition(outletCount + 1, index + 1)}`}
				title={`Outlet ${index}`}
				class="z-1"
			/>
		{/each}
	{/snippet}

	{#snippet codeEditor()}
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
	{/snippet}
</CanvasPreviewLayout>
