<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
	import { GLSystem } from '$lib/canvas/GLSystem';
	import { shouldShowHandles } from '../../../stores/ui.store';
	import VirtualConsole from '$lib/components/VirtualConsole.svelte';
	import { createCustomConsole } from '$lib/utils/createCustomConsole';
	import { handleCodeError } from '$lib/js-runner/handleCodeError';
	import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
	import type { ConsoleOutputEvent } from '$lib/eventbus/events';
	import { CANVAS_DOM_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
	import type { Textmodifier } from 'textmode.js';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			title: string;
			code: string;
			inletCount?: number;
			outletCount?: number;
			hidePorts?: boolean;
			executeCode?: number;
			showConsole?: boolean;
			fontSize?: number;
			frameRate?: number;
		};
		selected?: boolean;
	} = $props();

	let consoleRef: VirtualConsole | null = $state(null);

	// Track error line numbers for code highlighting
	let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
	const eventBus = PatchiesEventBus.getInstance();

	// Listen for console output events to capture lineErrors
	function handleConsoleOutput(event: ConsoleOutputEvent) {
		if (event.nodeId !== nodeId) return;

		// If this error has lineErrors, update state for code highlighting
		if (event.messageType === 'error' && event.lineErrors) {
			lineErrors = event.lineErrors;
		}
	}

	// Create custom console for routing output to VirtualConsole
	const customConsole = createCustomConsole(nodeId);

	let glSystem = GLSystem.getInstance();
	let messageContext: MessageContext;
	let canvas = $state<HTMLCanvasElement | undefined>();
	let dragEnabled = $state(true);
	let videoOutputEnabled = $state(true);
	let editorReady = $state(false);
	let bitmapLoopId: number | null = null;

	// textmode.js instances
	let textmode: typeof import('textmode.js') | null = null;
	let tm: Textmodifier | null = null;

	const { updateNodeData } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	const [defaultOutputWidth, defaultOutputHeight] = DEFAULT_OUTPUT_SIZE;

	let outputWidth = $state(defaultOutputWidth);
	let outputHeight = $state(defaultOutputHeight);
	let previewWidth = $derived(outputWidth / PREVIEW_SCALE_FACTOR);
	let previewHeight = $derived(outputHeight / PREVIEW_SCALE_FACTOR);

	let inletCount = $derived(data.inletCount ?? 1);
	let outletCount = $derived(data.outletCount ?? 0);
	let previousExecuteCode = $state<number | undefined>(undefined);

	// Watch for executeCode timestamp changes and re-run when it changes
	$effect(() => {
		if (data.executeCode && data.executeCode !== previousExecuteCode) {
			previousExecuteCode = data.executeCode;
			runCode();
		}
	});

	const setPortCount = (newInletCount = 1, newOutletCount = 0) => {
		updateNodeData(nodeId, { inletCount: newInletCount, outletCount: newOutletCount });
		updateNodeInternals(nodeId);
	};

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { code: newCode });
		setTimeout(() => runCode());
	};

	const handleMessage: MessageCallbackFn = (message, _meta) => {
		try {
			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, () => {
					runCode();
				});
		} catch (error) {
			console.error('Error handling message:', error);
		}
	};

	function setupCanvas() {
		if (!canvas) return;

		// Set canvas to full output resolution
		canvas.width = outputWidth;
		canvas.height = outputHeight;

		// Display at preview size
		canvas.style.width = `${previewWidth}px`;
		canvas.style.height = `${previewHeight}px`;
	}

	function setCanvasSize(width: number, height: number) {
		if (!canvas) return;

		outputWidth = width;
		outputHeight = height;

		// Update canvas resolution
		canvas.width = width;
		canvas.height = height;

		// Update display size
		canvas.style.width = `${previewWidth}px`;
		canvas.style.height = `${previewHeight}px`;
	}

	async function sendBitmap() {
		if (!canvas) return;
		if (!glSystem.hasOutgoingVideoConnections(nodeId)) return;

		await glSystem.setBitmapSource(nodeId, canvas);
	}

	function startBitmapLoop() {
		if (bitmapLoopId !== null) return;

		const loop = () => {
			if (tm?.isLooping) sendBitmap();

			bitmapLoopId = requestAnimationFrame(loop);
		};

		bitmapLoopId = requestAnimationFrame(loop);
	}

	function stopBitmapLoop() {
		if (bitmapLoopId !== null) {
			cancelAnimationFrame(bitmapLoopId);
			bitmapLoopId = null;
		}
	}

	async function runCode() {
		if (!canvas) return;

		// Clear console and error highlighting on re-run
		consoleRef?.clearConsole();
		lineErrors = undefined;

		// Reset drag state and video output state
		dragEnabled = true;
		videoOutputEnabled = true;

		try {
			// Clear timers from message context
			messageContext.clearTimers();

			// Stop bitmap loop and destroy existing textmode instance on re-run
			stopBitmapLoop();

			// Import textmode.js if needed
			if (!textmode) {
				textmode = await import('textmode.js');
			}

			if (!tm) {
				tm = textmode.create({
					width: outputWidth,
					height: outputHeight,
					fontSize: data.fontSize ?? 18,
					frameRate: data.frameRate ?? 60,
					canvas
				});
			}

			const context = messageContext.getContext();

			const userGlobals = {
				canvas,
				tm,
				textmode,
				width: outputWidth,
				height: outputHeight,
				setPortCount,
				console: customConsole,
				...context,
				recv: context.onMessage,
				noDrag: () => {
					dragEnabled = false;
				},
				noOutput: () => {
					videoOutputEnabled = false;
					updateNodeInternals(nodeId);
				},
				setTitle: (title: string) => updateNodeData(nodeId, { title }),
				setHidePorts: (hidePorts: boolean) => updateNodeData(nodeId, { hidePorts }),
				setCanvasSize: (width: number, height: number) => setCanvasSize(width, height),
				requestAnimationFrame: (callback: FrameRequestCallback) => {
					return requestAnimationFrame((time) => {
						callback(time);
						sendBitmap();
					});
				},
				cancelAnimationFrame: (id: number) => {
					cancelAnimationFrame(id);
				}
			};

			// Execute user code
			const userFunction = new Function(...Object.keys(userGlobals), `"use strict";\n${data.code}`);

			userFunction(...Object.values(userGlobals));

			// Start bitmap loop after code execution to send frames to GLSystem
			if (tm.isLooping()) {
				startBitmapLoop();
			}
		} catch (error) {
			handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
		}
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Listen for console output events to capture lineErrors
		eventBus.addEventListener('consoleOutput', handleConsoleOutput);

		// Register with GLSystem for video output
		glSystem.upsertNode(nodeId, 'img', {});

		setupCanvas();

		setTimeout(() => {
			runCode();
		}, 50);
	});

	onDestroy(() => {
		stopBitmapLoop();
		tm?.destroy();
		eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
		glSystem?.removeNode(nodeId);
		messageContext?.destroy();
	});

	const handleClass = $derived.by(() => {
		// only apply the custom handles if setHidePorts(true) is set
		if (!data.hidePorts) return '';

		if (!selected && $shouldShowHandles) {
			return 'z-1 transition-opacity';
		}

		return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});
</script>

<CanvasPreviewLayout
	title={data.title ?? 'textmode.dom'}
	{nodeId}
	onrun={runCode}
	bind:previewCanvas={canvas}
	nodrag={!dragEnabled}
	tabindex="0"
	width={outputWidth}
	height={outputHeight}
	style={`width: ${previewWidth}px; height: ${previewHeight}px;`}
	{selected}
	{editorReady}
	hasError={lineErrors !== undefined}
>
	{#snippet topHandle()}
		{#each Array.from({ length: inletCount }) as _, index}
			<StandardHandle
				port="inlet"
				id={index}
				title={`Inlet ${index}`}
				total={inletCount}
				{index}
				class={handleClass}
				{nodeId}
			/>
		{/each}
	{/snippet}

	{#snippet bottomHandle()}
		{#if videoOutputEnabled}
			<StandardHandle
				port="outlet"
				type="video"
				id="0"
				title="Video output"
				total={outletCount + 1}
				index={0}
				class={handleClass}
				{nodeId}
			/>
		{/if}

		{#each Array.from({ length: outletCount }) as _, index}
			<StandardHandle
				port="outlet"
				id={index}
				title={`Outlet ${index}`}
				total={videoOutputEnabled ? outletCount + 1 : outletCount}
				index={videoOutputEnabled ? index + 1 : index}
				class={handleClass}
				{nodeId}
			/>
		{/each}
	{/snippet}

	{#snippet codeEditor()}
		<CodeEditor
			value={data.code}
			language="javascript"
			nodeType="textmode.dom"
			placeholder="Write your Textmode.js code here..."
			class="nodrag h-64 w-full resize-none"
			onrun={runCode}
			onchange={(newCode) => {
				updateNodeData(nodeId, { code: newCode });
			}}
			onready={() => (editorReady = true)}
			{lineErrors}
		/>
	{/snippet}

	{#snippet console()}
		<!-- Always render VirtualConsole so it receives events even when hidden -->
		<div class="mt-3 w-full" class:hidden={!data.showConsole}>
			<VirtualConsole
				bind:this={consoleRef}
				{nodeId}
				placeholder="Textmode errors will appear here."
				maxHeight="200px"
			/>
		</div>
	{/snippet}
</CanvasPreviewLayout>
