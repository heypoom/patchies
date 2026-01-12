<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
	import type { NodePortCountUpdateEvent, NodeTitleUpdateEvent } from '$lib/eventbus/events';

	let {
		id: nodeId,
		data,
		selected
	}: NodeProps & {
		data: {
			title?: string;
			code: string;
			messageInletCount?: number;
			messageOutletCount?: number;
			videoInletCount?: number;
			videoOutletCount?: number;
			executeCode?: number;
		};
	} = $props();

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	let glSystem: GLSystem;
	let audioAnalysisSystem: AudioAnalysisSystem;
	let messageContext: MessageContext;
	let previewCanvas = $state<HTMLCanvasElement | undefined>();
	let previewBitmapContext: ImageBitmapRenderingContext;
	let isPaused = $state(false);
	let editorReady = $state(false);
	let errorMessage = $state<string | null>(null);
	let previousExecuteCode = $state<number | undefined>(undefined);

	// Actual rendering resolution (for mouse coordinates)
	let outputWidth = $state(800);
	let outputHeight = $state(600);

	// Detect if Hydra code uses mouse variable (ignore comments)
	const usesMouseVariable = $derived.by(() => {
		// Remove single-line comments
		const codeWithoutComments = code.replace(/\/\/.*$/gm, '');

		return codeWithoutComments.includes('mouse');
	});

	// Watch for executeCode timestamp changes and re-run when it changes
	$effect(() => {
		if (data.executeCode && data.executeCode !== previousExecuteCode) {
			previousExecuteCode = data.executeCode;
			updateHydra();
		}
	});

	// Store event handler for cleanup
	function handlePortCountUpdate(e: NodePortCountUpdateEvent) {
		if (e.nodeId !== nodeId) return;

		match(e)
			.with({ portType: 'message' }, (m) => {
				updateNodeData(nodeId, {
					messageInletCount: m.inletCount,
					messageOutletCount: m.outletCount
				});
			})
			.with({ portType: 'video' }, (m) => {
				updateNodeData(nodeId, {
					videoInletCount: m.inletCount,
					videoOutletCount: m.outletCount
				});
			})
			.exhaustive();

		updateNodeInternals(nodeId);
	}

	function handleTitleUpdate(e: NodeTitleUpdateEvent) {
		if (e.nodeId !== nodeId) return;

		updateNodeData(nodeId, { title: e.title });
	}

	const code = $derived(data.code || '');

	let messageInletCount = $derived(data.messageInletCount ?? 1);
	let messageOutletCount = $derived(data.messageOutletCount ?? 0);
	let videoInletCount = $derived(data.videoInletCount ?? 1);
	let videoOutletCount = $derived(data.videoOutletCount ?? 1);

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { code: newCode });
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

		// Initialize output dimensions from glSystem
		outputWidth = glSystem.outputSize[0];
		outputHeight = glSystem.outputSize[1];

		// Listen for port count updates from the worker
		const eventBus = glSystem.eventBus;

		eventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
		eventBus.addEventListener('nodeTitleUpdate', handleTitleUpdate);

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

		// Clean up event listeners
		const eventBus = glSystem.eventBus;
		eventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
		eventBus.removeEventListener('nodeTitleUpdate', handleTitleUpdate);
	});

	function updateHydra() {
		try {
			messageContext.clearTimers();
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

	function handleCanvasMouseMove(event: MouseEvent) {
		if (!previewCanvas || !usesMouseVariable) return;

		const rect = previewCanvas.getBoundingClientRect();

		// Get position relative to canvas in screen pixels
		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;

		// Map from displayed rect to actual framebuffer resolution (outputSize)
		// Hydra uses standard screen coordinates (Y-down, origin top-left)
		const x = (screenX / rect.width) * outputWidth;
		const y = (screenY / rect.height) * outputHeight;

		// Send mouse data (use x,y for both current and click position when moving)
		glSystem.setMouseData(nodeId, x, y, 0, 0);
	}

	// Attach mouse event listeners when canvas is available and mouse is used
	$effect(() => {
		if (!previewCanvas || !usesMouseVariable) return;

		previewCanvas.addEventListener('mousemove', handleCanvasMouseMove);

		return () => {
			if (!previewCanvas) return;

			previewCanvas.removeEventListener('mousemove', handleCanvasMouseMove);
		};
	});
</script>

<CanvasPreviewLayout
	title={data.title ?? 'hydra'}
	onrun={updateHydra}
	onPlaybackToggle={togglePause}
	paused={isPaused}
	showPauseButton={true}
	nodrag={usesMouseVariable}
	{selected}
	{editorReady}
	bind:previewCanvas
>
	{#snippet topHandle()}
		{#each Array.from({ length: videoInletCount }) as _, index (index)}
			<StandardHandle
				port="inlet"
				type="video"
				id={index.toString()}
				title={`Video Inlet ${index}`}
				total={messageInletCount + videoInletCount}
				{index}
				{nodeId}
			/>
		{/each}

		{#each Array.from({ length: messageInletCount }) as _, index (index)}
			<StandardHandle
				port="inlet"
				type="message"
				id={index + videoInletCount}
				title={`Message Inlet ${index}`}
				total={messageInletCount + videoInletCount}
				index={index + videoInletCount}
				{nodeId}
			/>
		{/each}
	{/snippet}

	{#snippet bottomHandle()}
		{#each Array.from({ length: videoOutletCount }) as _, index (index)}
			<StandardHandle
				port="outlet"
				type="video"
				id={index.toString()}
				title={`Video Outlet ${index}`}
				total={messageOutletCount + videoOutletCount}
				{index}
				{nodeId}
			/>
		{/each}

		{#each Array.from({ length: messageOutletCount }) as _, index (index)}
			<StandardHandle
				port="outlet"
				type="message"
				id={index + videoOutletCount}
				title={`Outlet ${index}`}
				total={messageOutletCount + videoOutletCount}
				index={index + videoOutletCount}
				{nodeId}
			/>
		{/each}
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { code: newCode });
			}}
			language="javascript"
			nodeType="hydra"
			placeholder="Write your Hydra code here..."
			class="nodrag h-64 w-full resize-none"
			onrun={updateHydra}
			onready={() => (editorReady = true)}
		/>
	{/snippet}
</CanvasPreviewLayout>
