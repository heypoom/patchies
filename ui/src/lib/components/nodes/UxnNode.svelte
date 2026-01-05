<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { UxnEmulator, type UxnEmulatorOptions } from '$lib/uxn/UxnEmulator';
	import StandardHandle from '../StandardHandle.svelte';
	import Icon from '@iconify/svelte';
	import CanvasPreviewLayout from '../CanvasPreviewLayout.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';

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
			consoleOutput?: string;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let canvas: HTMLCanvasElement | undefined = $state();
	let emulator: UxnEmulator | null = $state(null);
	let consoleOutput = $state(data.consoleOutput || '');
	let showConsole = $state(data.showConsole ?? false);
	let isPaused = $state(false);
	let errorMessage = $state<string | null>(null);
	let cleanupEventHandlers: (() => void) | null | undefined = null;
	let messageContext: MessageContext;
	let fileInputRef: HTMLInputElement;
	let isDragging = $state(false);
	const fileName = $derived(data.fileName || 'No ROM loaded');
	const audioService = AudioService.getInstance();

	const handleConsoleOutput = (output: string, isError: boolean) => {
		consoleOutput += output;
		updateNodeData(nodeId, { consoleOutput, showConsole });
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

		(async () => {
			if (!canvas) return;

			try {
				const options: UxnEmulatorOptions = {
					nodeId,
					canvasElement: canvas,
					onConsoleOutput: handleConsoleOutput
				};

				emulator = new UxnEmulator(options);

				// Create audio node for Uxn audio device
				await audioService.createNode(nodeId, 'uxn', [emulator.audio]);

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
		cleanupEventHandlers?.();

		// Remove audio node
		const audioNode = audioService.getNodeById(nodeId);
		if (audioNode) {
			audioService.removeNode(audioNode);
		}

		emulator?.destroy();
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
		} else {
			emulator?.startRenderLoop();
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
</script>

<CanvasPreviewLayout
	title="uxn"
	bind:previewCanvas={canvas}
	width={512}
	height={320}
	style="width: 512px; height: 320px; image-rendering: pixelated; image-rendering: crisp-edges;"
	{selected}
	showPauseButton={true}
	paused={isPaused}
	onPlaybackToggle={togglePause}
	nodrag
>
	{#snippet topHandle()}
		<StandardHandle port="inlet" type="message" id={0} title="ROM input" total={1} index={0} />
	{/snippet}

	{#snippet bottomHandle()}
		<StandardHandle port="outlet" type="audio" id={0} title="Audio output" total={2} index={0} />
		<StandardHandle port="outlet" type="video" id={0} title="Video output" total={2} index={1} />
	{/snippet}

	{#snippet codeEditor()}
		<div class="flex flex-col gap-2">
			{#if errorMessage}
				<div class="rounded border border-red-700 bg-red-900/50 p-2 font-mono text-xs text-red-300">
					{errorMessage}
				</div>
			{/if}

			<div class="flex flex-col gap-2 p-2">
				<div class="text-xs text-zinc-400">{fileName}</div>
				<div class="flex items-center gap-2">
					<button
						onclick={openFileDialog}
						class="rounded bg-zinc-700 px-2 py-1 text-xs text-white hover:bg-zinc-600"
						title="Load ROM file"
					>
						<Icon icon="lucide:folder-open" class="h-4 w-4" />
						Load ROM
					</button>
					<button
						onclick={() => {
							showConsole = !showConsole;
							updateNodeData(nodeId, { showConsole });
						}}
						class="rounded bg-zinc-700 px-2 py-1 text-xs text-white hover:bg-zinc-600"
						title="Toggle console"
					>
						<Icon icon="lucide:terminal" class="h-4 w-4" />
					</button>
				</div>
			</div>

			<input
				type="file"
				bind:this={fileInputRef}
				accept=".rom"
				onchange={handleFileSelect}
				class="hidden"
			/>

			{#if showConsole && consoleOutput}
				<div class="max-h-32 overflow-y-auto rounded bg-zinc-900 p-2 font-mono text-xs text-white">
					{consoleOutput}
				</div>
			{/if}
		</div>
	{/snippet}
</CanvasPreviewLayout>
