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
	import { logger } from '$lib/utils/logger';

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
		};
		selected?: boolean;
	} = $props();

	let glSystem = GLSystem.getInstance();
	let messageContext: MessageContext;
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

	// Mouse state - coordinates scaled to canvas resolution
	let mouse = $state({
		x: 0,
		y: 0,
		down: false,
		buttons: 0
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

		const updateTouchPosition = (e: TouchEvent) => {
			if (e.touches.length === 0) return;
			const touch = e.touches[0];
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
			mouse.down = false;
			mouse.buttons = 0;
		};

		const onTouchCancel = (e: TouchEvent) => {
			e.preventDefault();
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

	function runCode() {
		if (!canvas || !ctx) return;

		// Reset drag state and video output state
		dragEnabled = true;
		videoOutputEnabled = true;

		try {
			// Clear any previous animation frame
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}

			// Clear timers from message context
			messageContext.clearTimers();

			// Get message context methods
			const context = messageContext.getContext();

			// Create user code execution context
			// Note: width/height match the full output resolution (same as worker canvas)
			const userGlobals = {
				canvas,
				ctx,
				width: outputWidth,
				height: outputHeight,
				mouse,
				setPortCount,
				...context,
				recv: context.onMessage, // Alias for consistency with worker canvas
				// Override context defaults with custom implementations (must be after ...context)
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
			};

			// Execute user code
			const userFunction = new Function(...Object.keys(userGlobals), `"use strict";\n${data.code}`);
			userFunction(...Object.values(userGlobals));
		} catch (error) {
			logger.error(`[canvas.dom] user code error:`, error);
		}
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Register with GLSystem for video output
		glSystem.upsertNode(nodeId, 'img', {});

		setupCanvas();

		const cleanupMouse = setupMouseListeners();

		setTimeout(() => {
			runCode();
		}, 50);

		return () => {
			cleanupMouse?.();
		};
	});

	onDestroy(() => {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
		}
		glSystem?.removeNode(nodeId);
		messageContext?.destroy();
	});

	const handleClass = $derived.by(() => {
		if (!data.hidePorts) return '';

		return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
	});
</script>

<CanvasPreviewLayout
	title={data.title ?? 'canvas.dom'}
	onrun={runCode}
	bind:previewCanvas={canvas}
	nodrag={!dragEnabled}
	width={outputWidth}
	height={outputHeight}
	style={`width: ${previewWidth}px; height: ${previewHeight}px;`}
	{selected}
	{editorReady}
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
		/>
	{/snippet}
</CanvasPreviewLayout>
