<script lang="ts">
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { JSRunner } from '$lib/js-runner/JSRunner';
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

	const jsRunner = JSRunner.getInstance();
	let glSystem = GLSystem.getInstance();
	let canvas = $state<HTMLCanvasElement | undefined>();
	let ctx: CanvasRenderingContext2D | null = null;
	let dragEnabled = $state(true);
	let videoOutputEnabled = $state(true);
	let editorReady = $state(false);
	let animationFrameId: number | null = null;

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

	// Mouse state - coordinates scaled to canvas resolution
	let mouse = $state({
		x: 0,
		y: 0,
		down: false,
		buttons: 0
	});

	// Keyboard state and user callbacks
	let keyboardCallbacks = $state<{
		onKeyDown?: (event: KeyboardEvent) => void;
		onKeyUp?: (event: KeyboardEvent) => void;
	}>({});

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
				})
				.otherwise(() => {
					// Messages are delivered via recv() callback set by user code
				});
		} catch (error) {
			console.error('Error handling message:', error);
		}
	};

	function setupMouseListeners() {
		if (!canvas) return;

		const updateMousePosition = (e: MouseEvent) => {
			const rect = canvas!.getBoundingClientRect();
			// Scale mouse coordinates to canvas resolution (outputWidth × outputHeight)
			mouse.x = ((e.clientX - rect.left) / rect.width) * outputWidth;
			mouse.y = ((e.clientY - rect.top) / rect.height) * outputHeight;
			mouse.buttons = e.buttons;
		};

		const updateTouchPosition = (e: TouchEvent, useChangedTouches = false) => {
			// Use changedTouches for touchend/touchcancel, touches for touchstart/touchmove
			const touchList = useChangedTouches ? e.changedTouches : e.touches;
			if (touchList.length === 0) return;
			const touch = touchList[0];
			const rect = canvas!.getBoundingClientRect();
			// Scale touch coordinates to canvas resolution (outputWidth × outputHeight)
			mouse.x = ((touch.clientX - rect.left) / rect.width) * outputWidth;
			mouse.y = ((touch.clientY - rect.top) / rect.height) * outputHeight;
			// Set buttons to 1 (primary button) for touch events
			mouse.buttons = 1;
		};

		const onMouseMove = (e: MouseEvent) => {
			updateMousePosition(e);
		};

		const onMouseDown = (e: MouseEvent) => {
			updateMousePosition(e);
			mouse.down = true;
		};

		const onMouseUp = (e: MouseEvent) => {
			updateMousePosition(e);
			mouse.down = false;
		};

		const onMouseLeave = () => {
			mouse.down = false;
			mouse.buttons = 0;
		};

		const onTouchStart = (e: TouchEvent) => {
			e.preventDefault(); // Prevent mouse events from firing
			updateTouchPosition(e);
			mouse.down = true;
		};

		const onTouchMove = (e: TouchEvent) => {
			e.preventDefault(); // Prevent scrolling
			updateTouchPosition(e);
		};

		const onTouchEnd = (e: TouchEvent) => {
			e.preventDefault();
			updateTouchPosition(e, true); // Use changedTouches for final position
			mouse.down = false;
			mouse.buttons = 0;
		};

		const onTouchCancel = (e: TouchEvent) => {
			e.preventDefault();
			updateTouchPosition(e, true); // Use changedTouches for final position
			mouse.down = false;
			mouse.buttons = 0;
		};

		canvas.addEventListener('mousemove', onMouseMove);
		canvas.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mouseup', onMouseUp);
		canvas.addEventListener('mouseleave', onMouseLeave);
		canvas.addEventListener('touchstart', onTouchStart, { passive: false });
		canvas.addEventListener('touchmove', onTouchMove, { passive: false });
		canvas.addEventListener('touchend', onTouchEnd, { passive: false });
		canvas.addEventListener('touchcancel', onTouchCancel, { passive: false });

		return () => {
			canvas?.removeEventListener('mousemove', onMouseMove);
			canvas?.removeEventListener('mousedown', onMouseDown);
			canvas?.removeEventListener('mouseup', onMouseUp);
			canvas?.removeEventListener('mouseleave', onMouseLeave);
			canvas?.removeEventListener('touchstart', onTouchStart);
			canvas?.removeEventListener('touchmove', onTouchMove);
			canvas?.removeEventListener('touchend', onTouchEnd);
			canvas?.removeEventListener('touchcancel', onTouchCancel);
		};
	}

	function setupKeyboardListeners() {
		if (!canvas) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (keyboardCallbacks.onKeyDown) {
				// Stop propagation for all keyboard events to prevent leaking to xyflow
				e.stopPropagation();

				try {
					keyboardCallbacks.onKeyDown(e);
				} catch (error) {
					handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
				}
			}
		};

		const onKeyUp = (e: KeyboardEvent) => {
			if (keyboardCallbacks.onKeyUp) {
				// Stop propagation for all keyboard events to prevent leaking to xyflow
				e.stopPropagation();

				try {
					keyboardCallbacks.onKeyUp(e);
				} catch (error) {
					handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
				}
			}
		};

		canvas.addEventListener('keydown', onKeyDown);
		canvas.addEventListener('keyup', onKeyUp);

		return () => {
			canvas?.removeEventListener('keydown', onKeyDown);
			canvas?.removeEventListener('keyup', onKeyUp);
		};
	}

	function setupCanvas() {
		if (!canvas) return;

		// Set canvas to full output resolution (same as worker canvas)
		// This matches the behavior of the worker-based canvas node
		canvas.width = outputWidth;
		canvas.height = outputHeight;

		// Display at preview size
		canvas.style.width = `${previewWidth}px`;
		canvas.style.height = `${previewHeight}px`;

		ctx = canvas.getContext('2d');
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

	async function runCode() {
		if (!canvas || !ctx) return;

		// Clear console and error highlighting on re-run
		consoleRef?.clearConsole();
		lineErrors = undefined;

		// Reset drag state and video output state
		dragEnabled = true;
		videoOutputEnabled = true;

		// Clear keyboard callbacks when code is re-run
		keyboardCallbacks = {};

		// Clear any previous animation frame
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		try {
			await jsRunner.executeJavaScript(nodeId, data.code, {
				customConsole,
				setPortCount,
				setTitle: (title: string) => updateNodeData(nodeId, { title }),
				setHidePorts: (hidePorts: boolean) => updateNodeData(nodeId, { hidePorts }),
				extraContext: {
					canvas,
					ctx,
					width: outputWidth,
					height: outputHeight,
					mouse,
					noDrag: () => {
						dragEnabled = false;
					},
					noOutput: () => {
						videoOutputEnabled = false;
						updateNodeInternals(nodeId);
					},
					setCanvasSize: (width: number, height: number) => setCanvasSize(width, height),
					onKeyDown: (callback: (event: KeyboardEvent) => void) => {
						keyboardCallbacks.onKeyDown = callback;
					},
					onKeyUp: (callback: (event: KeyboardEvent) => void) => {
						keyboardCallbacks.onKeyUp = callback;
					},
					// Override JSRunner's requestAnimationFrame to also send bitmap
					requestAnimationFrame: (callback: FrameRequestCallback) => {
						animationFrameId = requestAnimationFrame((time) => {
							callback(time);
							sendBitmap();
						});
						return animationFrameId;
					},
					cancelAnimationFrame: (id: number) => {
						cancelAnimationFrame(id);
						if (animationFrameId === id) {
							animationFrameId = null;
						}
					}
				}
			});
		} catch (error) {
			handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
		}
	}

	onMount(() => {
		const messageContext = jsRunner.getMessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Listen for console output events to capture lineErrors
		eventBus.addEventListener('consoleOutput', handleConsoleOutput);

		// Register with GLSystem for video output
		glSystem.upsertNode(nodeId, 'img', {});

		setupCanvas();

		const cleanupMouse = setupMouseListeners();
		const cleanupKeyboard = setupKeyboardListeners();

		setTimeout(() => {
			runCode();
		}, 50);

		return () => {
			cleanupMouse?.();
			cleanupKeyboard?.();
		};
	});

	onDestroy(() => {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
		}
		eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
		glSystem?.removeNode(nodeId);
		jsRunner.destroy(nodeId);
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
	title={data.title ?? 'canvas.dom'}
	{nodeId}
	onrun={runCode}
	bind:previewCanvas={canvas}
	nodrag={!dragEnabled}
	tabindex={0}
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
			nodeType="canvas.dom"
			placeholder="Write your Canvas API code here..."
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
				placeholder="Canvas errors will appear here."
				maxHeight="200px"
			/>
		</div>
	{/snippet}
</CanvasPreviewLayout>
