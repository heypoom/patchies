<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { UxnEmulator, type UxnEmulatorOptions } from '$lib/uxn/UxnEmulator';
	import StandardHandle from '../StandardHandle.svelte';
	import Icon from '@iconify/svelte';
	import CodeEditor from '../CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { asm } from 'uxn.wasm/util';
	import * as Tooltip from '../ui/tooltip';
	import { GLSystem } from '$lib/canvas/GLSystem';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			rom?: Uint8Array;
			fileName?: string;
			url?: string;
			code?: string;
			showConsole?: boolean;
			showEditor?: boolean;
			consoleOutput?: string;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let canvas: HTMLCanvasElement | undefined = $state();
	let previewContainer: HTMLDivElement | null = $state(null);
	let emulator: UxnEmulator | null = $state(null);
	let consoleOutput = $state(data.consoleOutput || '');
	let showConsole = $state(data.showConsole ?? false);
	let showEditor = $state(data.showEditor ?? false);
	let isPaused = $state(false);
	let errorMessage = $state<string | null>(null);
	let cleanupEventHandlers: (() => void) | null | undefined = null;
	let messageContext: MessageContext;
	let fileInputRef: HTMLInputElement;
	let isDragging = $state(false);
	let glSystem = GLSystem.getInstance();
	let bitmapFrameId: number | null = null;
	const fileName = $derived(data.fileName || 'No ROM loaded');
	const hasROM = $derived(!!data.rom);
	const code = $derived(data.code || '');

	const editorGap = 10;
	let previewContainerWidth = $state(0);

	function measureContainerWidth() {
		if (previewContainer) {
			previewContainerWidth = previewContainer.clientWidth;
		}
	}

	let editorLeftPos = $derived.by(() => {
		return (previewContainerWidth ?? 512) + editorGap;
	});

	const handleConsoleOutput = (output: string, isError: boolean) => {
		consoleOutput += output;
		updateNodeData(nodeId, { consoleOutput, showConsole });

		// Send console output as message
		if (messageContext) {
			messageContext.send(output);
		}
	};

	const handleMessage: MessageCallbackFn = async (message) => {
		match(message)
			.with(P.string, (url) => loadFromUrl(url))
			.with({ type: 'load', url: P.string }, ({ url }) => loadFromUrl(url))
			.with(P.instanceOf(Uint8Array), (rom) => loadROM(rom))
			.with(P.instanceOf(File), async (file) => {
				const arrayBuffer = await file.arrayBuffer();
				loadROM(new Uint8Array(arrayBuffer));
			})
			.otherwise(() => {
				console.warn('UxnNode: Unsupported message type', message);
			});
	};

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);
		measureContainerWidth();
		glSystem.upsertNode(nodeId, 'img', {});
		startBitmapUpload();

		(async () => {
			if (!canvas) return;

			try {
				const options: UxnEmulatorOptions = {
					nodeId,
					canvasElement: canvas,
					onConsoleOutput: handleConsoleOutput
				};

				emulator = new UxnEmulator(options);
				await emulator.init(options);

				// Load ROM if provided
				if (data.rom) {
					emulator.load(data.rom);
				} else if (data.url) {
					await loadFromUrl(data.url);
				}

				// Set up event handlers
				const cleanup = setupEventHandlers();
				if (cleanup) {
					cleanupEventHandlers = cleanup;
				}
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		})();

		return () => {
			messageContext.queue.removeCallback(handleMessage);
		};
	});

	onDestroy(() => {
		stopBitmapUpload();
		cleanupEventHandlers?.();
		emulator?.destroy();
		glSystem.removeNode(nodeId);
		messageContext?.destroy();
	});

	function shouldTrapKey(event: KeyboardEvent): boolean {
		// Keys handled by ControllerDevice.on_keybutton:
		// - Modifiers: Control, Alt, Shift, Meta (cmd)
		// - Navigation: Home, Arrow keys
		// - Escape
		// - Printable characters (event.key.length == 1)
		// - Special keys
		if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
			return true;
		}
		const key = event.key;
		if (key === 'Escape' || key === 'Home') {
			return true;
		}
		if (key.startsWith('Arrow')) {
			return true; // ArrowUp, ArrowDown, ArrowLeft, ArrowRight
		}
		if (key.length === 1) {
			return true; // Printable character
		}
		// Special keys like Tab, Enter, Backspace, etc.
		const specialKeys = [
			'Tab',
			'Enter',
			'Backspace',
			'Delete',
			'Insert',
			'PageUp',
			'PageDown',
			'End'
		];
		if (specialKeys.includes(key)) {
			return true;
		}
		return false;
	}

	function setupEventHandlers() {
		if (!canvas || !emulator) return;

		// Keyboard events
		const handleKeyDown = (event: KeyboardEvent) => {
			if (shouldTrapKey(event)) {
				event.preventDefault();
				event.stopPropagation();
			}
			if (emulator) {
				emulator.controller.on_keybutton(event);
			}
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			if (shouldTrapKey(event)) {
				event.preventDefault();
				event.stopPropagation();
			}
			if (emulator) {
				emulator.controller.on_keybutton(event);
			}
		};

		// Mouse events
		const handlePointerMove = (event: PointerEvent) => {
			if (emulator && canvas) {
				emulator.mouse.on_move(event, canvas);
			}
		};

		const handlePointerDown = (event: PointerEvent) => {
			if (emulator) {
				emulator.mouse.on_down(event);
			}
		};

		const handlePointerUp = (event: PointerEvent) => {
			if (emulator) {
				emulator.mouse.on_up(event);
			}
		};

		const handleWheel = (event: WheelEvent) => {
			if (emulator) {
				emulator.mouse.on_scroll(event);
			}
		};

		// Drag and drop events
		const handleCanvasDragOver = (event: DragEvent) => {
			event.preventDefault();
			isDragging = true;
		};

		const handleCanvasDragLeave = (event: DragEvent) => {
			event.preventDefault();
			isDragging = false;
		};

		const handleCanvasDrop = (event: DragEvent) => {
			event.preventDefault();
			event.stopPropagation();
			isDragging = false;

			const files = event.dataTransfer?.files;
			if (!files || files.length === 0) return;

			const file = files[0];
			loadFile(file);
		};

		// Attach to canvas
		canvas.addEventListener('keydown', handleKeyDown);
		canvas.addEventListener('keyup', handleKeyUp);
		canvas.addEventListener('pointermove', handlePointerMove);
		canvas.addEventListener('pointerdown', handlePointerDown);
		canvas.addEventListener('pointerup', handlePointerUp);
		canvas.addEventListener('wheel', handleWheel);
		canvas.addEventListener('dragover', handleCanvasDragOver);
		canvas.addEventListener('dragleave', handleCanvasDragLeave);
		canvas.addEventListener('drop', handleCanvasDrop);

		// Make canvas focusable for keyboard events
		canvas.tabIndex = 0;

		return () => {
			canvas?.removeEventListener('keydown', handleKeyDown);
			canvas?.removeEventListener('keyup', handleKeyUp);
			canvas?.removeEventListener('pointermove', handlePointerMove);
			canvas?.removeEventListener('pointerdown', handlePointerDown);
			canvas?.removeEventListener('pointerup', handlePointerUp);
			canvas?.removeEventListener('wheel', handleWheel);
			canvas?.removeEventListener('dragover', handleCanvasDragOver);
			canvas?.removeEventListener('dragleave', handleCanvasDragLeave);
			canvas?.removeEventListener('drop', handleCanvasDrop);
		};
	}

	function togglePause() {
		isPaused = !isPaused;
		if (isPaused) {
			emulator?.stopRenderLoop();
			stopBitmapUpload();
		} else {
			emulator?.startRenderLoop();
			startBitmapUpload();
		}
	}

	async function loadFromUrl(url: string) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to load ROM: ${response.statusText}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			const rom = new Uint8Array(arrayBuffer);
			loadROM(rom, url);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function loadROM(rom: Uint8Array, url?: string, fileName?: string) {
		if (emulator) {
			emulator.load(rom);
			const name = fileName || (url ? url.split('/').pop() || 'rom.rom' : 'rom.rom');
			updateNodeData(nodeId, { rom, url, fileName: name });
			errorMessage = null;
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		loadFile(file);
	}

	async function loadFile(file: File) {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const rom = new Uint8Array(arrayBuffer);
			loadROM(rom, undefined, file.name);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function openFileDialog() {
		fileInputRef?.click();
	}

	async function uploadBitmap() {
		if (!canvas || !emulator || isPaused) return;

		if (glSystem.hasOutgoingVideoConnections(nodeId)) {
			await glSystem.setBitmapSource(nodeId, canvas);
		}

		bitmapFrameId = requestAnimationFrame(uploadBitmap);
	}

	function startBitmapUpload() {
		if (bitmapFrameId !== null) return;
		bitmapFrameId = requestAnimationFrame(uploadBitmap);
	}

	function stopBitmapUpload() {
		if (bitmapFrameId !== null) {
			cancelAnimationFrame(bitmapFrameId);
			bitmapFrameId = null;
		}
	}

	function assembleAndLoad() {
		if (!emulator) return;

		try {
			// Clear previous errors and console output
			errorMessage = null;
			consoleOutput = '';
			updateNodeData(nodeId, { consoleOutput: '', errorMessage: null });

			// Assemble the code
			const rom = asm(code);

			// Load the assembled ROM
			loadROM(rom, undefined, 'assembled.rom');
			updateNodeData(nodeId, { code, rom, fileName: 'assembled.rom' });

			measureContainerWidth();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			errorMessage = errorMsg;
			updateNodeData(nodeId, { errorMessage: errorMsg });
		}
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-lg">
					<div class="font-mono text-xs font-medium text-zinc-400">uxn</div>
				</div>

				<div class="flex gap-1">
					<button
						title={isPaused ? 'Resume' : 'Pause'}
						class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
						onclick={togglePause}
					>
						<Icon icon={isPaused ? 'lucide:play' : 'lucide:pause'} class="h-4 w-4 text-zinc-300" />
					</button>

					<Tooltip.Root>
						<Tooltip.Trigger>
							<button
								class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
								onclick={openFileDialog}
								title="Load ROM file"
							>
								<Icon icon="lucide:folder-open" class="h-4 w-4 text-zinc-300" />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Load ROM</p>
						</Tooltip.Content>
					</Tooltip.Root>

					<Tooltip.Root>
						<Tooltip.Trigger>
							<button
								class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
								onclick={() => {
									showEditor = !showEditor;
									updateNodeData(nodeId, { showEditor });
									measureContainerWidth();
								}}
								title="Edit code"
							>
								<Icon icon="lucide:code" class="h-4 w-4 text-zinc-300" />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Edit Code</p>
						</Tooltip.Content>
					</Tooltip.Root>

					<Tooltip.Root>
						<Tooltip.Trigger>
							<button
								class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
								onclick={() => {
									showConsole = !showConsole;
									updateNodeData(nodeId, { showConsole });
								}}
								title="Toggle console"
							>
								<Icon icon="lucide:terminal" class="h-4 w-4 text-zinc-300" />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Console</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" id={0} title="ROM input" total={1} index={0} />
				<div bind:this={previewContainer}>
					<canvas
						bind:this={canvas}
						class={[
							'nodrag cursor-default rounded-md border',
							selected
								? 'shadow-glow-md border-zinc-400 [&>canvas]:rounded-[7px]'
								: 'hover:shadow-glow-sm border-transparent [&>canvas]:rounded-md'
						]}
						width={512}
						height={320}
						style="width: 512px; height: 320px; image-rendering: pixelated; image-rendering: crisp-edges;"
					></canvas>
				</div>
				<StandardHandle
					port="outlet"
					type="video"
					id={0}
					title="Video output"
					total={2}
					index={0}
				/>
				<StandardHandle
					port="outlet"
					type="message"
					id={0}
					title="Console output"
					total={2}
					index={1}
				/>
			</div>

			{#if errorMessage}
				<div class="rounded border border-red-700 bg-red-900/50 p-2 font-mono text-xs text-red-300">
					{errorMessage}
				</div>
			{/if}

			{#if showConsole}
				<div
					class="max-h-32 w-full max-w-[512px] overflow-y-auto whitespace-pre-wrap break-words rounded bg-zinc-900 p-2 font-mono text-xs text-white"
					style="word-wrap: break-word; overflow-wrap: break-word;"
				>
					{consoleOutput || '(no output)'}
				</div>
			{/if}
		</div>
	</div>

	<input
		type="file"
		bind:this={fileInputRef}
		accept=".rom"
		onchange={handleFileSelect}
		class="hidden"
	/>

	{#if showEditor}
		<div class="absolute" style="left: {editorLeftPos}px;">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				{#if assembleAndLoad}
					<Tooltip.Root>
						<Tooltip.Trigger>
							<button onclick={assembleAndLoad} class="rounded p-1 hover:bg-zinc-700">
								<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Assemble & Load (shift+enter)</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}

				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={code}
					onchange={(newCode) => {
						updateNodeData(nodeId, { code: newCode });
					}}
					language="assembly"
					placeholder="Write your Uxntal code here..."
					class="nodrag h-64 w-[500px] resize-none"
					onrun={assembleAndLoad}
				/>
			</div>
		</div>
	{/if}
</div>
