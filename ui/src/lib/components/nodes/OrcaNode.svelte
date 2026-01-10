<script lang="ts">
	import { Pause, Play, Settings, X } from '@lucide/svelte/icons';
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow, useViewport } from '@xyflow/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { Orca } from '$lib/orca/Orca';
	import { Clock } from '$lib/orca/Clock';
	import { IO } from '$lib/orca/io/IO';
	import { OrcaRenderer } from '$lib/orca/OrcaRenderer';
	import { library } from '$lib/orca/library';
	import { match, P } from 'ts-pattern';

	import StandardHandle from '../StandardHandle.svelte';
	import { DEFAULT_ORCA_HEIGHT, DEFAULT_ORCA_WIDTH } from '$lib/orca/constants';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: { grid: string; width: number; height: number; bpm: number; frame: number };
		selected: boolean;
	} = $props();

	const { updateNodeData, screenToFlowPosition } = useSvelteFlow();
	const viewport = useViewport();
	let messageContext = new MessageContext(nodeId);

	// Orca engine
	let orca: Orca | null = $state(null);
	let clock: Clock | null = $state(null);
	let io: IO | null = $state(null);
	let renderer: OrcaRenderer | null = $state(null);

	// UI state
	let canvas: HTMLCanvasElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();
	let bpm = $derived(data.bpm || 120);
	let gridWidth = $derived(data.width || DEFAULT_ORCA_WIDTH);
	let gridHeight = $derived(data.height || DEFAULT_ORCA_HEIGHT);
	let cursorX = $state(0);
	let cursorY = $state(0);
	let isPlaying = $state(true);
	let previewContainerWidth = $state(0);
	let showSettings = $state(false);
	let showInterface = $state(true);
	let showGuide = $state(false);

	// Selection state (matching original Orca cursor.js)
	let selectionW = $state(0);
	let selectionH = $state(0);
	let mouseFrom: { x: number; y: number } | null = $state(null);

	// Scale factor for font size
	let fontSize = $state(1.0);

	// Canvas rendering scale
	let canvasDensity = $state(Math.round(window.devicePixelRatio) ?? 1);

	// Tile dimensions for mouse interaction
	let TILE_W = $derived(10 * fontSize);
	let TILE_H = $derived(15 * fontSize);

	const COLORS = {
		background: '#000000',
		f_high: '#ffffff',
		f_med: '#777777',
		f_low: '#444444',
		f_inv: '#000000',
		b_high: '#eeeeee',
		b_med: '#72dec2',
		b_low: '#444444',
		b_inv: '#ffb545',
		cursor: '#ffb545'
	};

	onMount(() => {
		if (!canvas) return;

		// Initialize Orca engine
		orca = new Orca(library);
		orca.load(gridWidth, gridHeight, data.grid || '', 0);

		clock = new Clock(orca);
		io = new IO(messageContext);
		renderer = new OrcaRenderer(canvas, orca, COLORS, fontSize, canvasDensity);

		// Connect IO to Orca so operators can access it
		orca.io = io;

		// Connect IO to Clock so it can silence notes on stop
		clock.setIO(io);

		// Set up clock callback
		clock.setCallback({
			onTick() {
				if (orca && io) {
					orca.run();
					io.run();
					render();
					updateNodeData(nodeId, { frame: orca.f });
				}
			}
		});

		// Set initial BPM
		clock.setSpeed(bpm, bpm, false);
		clock.isPuppet = false;

		// Start playing by default
		clock.start();

		// Message handler
		messageContext.queue.addCallback(handleMessage);

		// Initial render
		render();
		measureWidth();

		// Focus canvas after a short delay to allow rendering
		setTimeout(() => {
			canvas?.focus();
		}, 100);

		return () => {
			messageContext.queue.removeCallback(handleMessage);
		};
	});

	onDestroy(() => {
		if (clock) {
			clock.stop();
		}
		if (io) {
			io.silence();
			io.clear();
		}
		messageContext.destroy();
	});

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with({ type: 'set', value: P.string }, ({ value }) => {
					if (orca) {
						orca.replace(value);
						render();
						updateNodeData(nodeId, { grid: orca.s });
					}
				})
				.with({ type: 'bang' }, () => {
					togglePlay();
				})
				.with({ type: 'play' }, () => {
					if (clock && !isPlaying) {
						clock.start();
						isPlaying = true;
					}
				})
				.with({ type: 'stop' }, () => {
					if (clock && isPlaying) {
						clock.stop();
						isPlaying = false;
					}
				})
				.with({ type: 'setBpm', value: P.number }, ({ value }) => {
					if (clock) {
						clock.setSpeed(value, value);
						updateNodeData(nodeId, { bpm: value });
					}
				});
		} catch (error) {
			console.error('OrcaNode handleMessage error:', error);
		}
	};

	function togglePlay(): void {
		if (clock) {
			if (isPlaying) {
				clock.stop();
			} else {
				clock.play();
			}
			isPlaying = !isPlaying;
		}
	}

	function measureWidth() {
		if (containerElement) {
			previewContainerWidth = containerElement.clientWidth;
		}
	}

	function handleKeyDown(e: KeyboardEvent): void {
		if (!orca) return;

		// Trap all keys to prevent Patchies from handling them
		const isHandled = handleOrcaKeyInput(e);
		if (isHandled) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	function handleOrcaKeyInput(e: KeyboardEvent): boolean {
		if (!orca) return false;

		// Handle font size shortcuts (Ctrl/Cmd +/-)
		if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
			e.preventDefault();
			fontSize = Math.min(3.0, fontSize + 0.1);
			render();
			measureWidth();
			return true;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === '-') {
			e.preventDefault();
			fontSize = Math.max(0.5, fontSize - 0.1);
			render();
			measureWidth();
			return true;
		}

		// Frame by frame: Ctrl/Cmd+F
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
			e.preventDefault();
			if (clock) clock.touch();
			return true;
		}

		// Reset frame: Ctrl/Cmd+Shift+R
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
			e.preventDefault();
			if (orca) {
				orca.f = 0;
				updateNodeData(nodeId, { frame: 0 });
				render();
			}
			return true;
		}

		// Speed increase: >
		if (e.key === '>' && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			increaseBpm();
			return true;
		}

		// Speed decrease: <
		if (e.key === '<' && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			decreaseBpm();
			return true;
		}

		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
			e.preventDefault();

			// Select all cells
			cursorX = 0;
			cursorY = 0;
			selectionW = orca.w - 1;
			selectionH = orca.h - 1;

			render();

			return true;
		}

		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
			performCopy();
			return true;
		}

		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
			performCut();
			return true;
		}

		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
			performPaste();
			return true;
		}

		switch (e.key) {
			case 'ArrowLeft':
				cursorX = Math.max(0, cursorX - 1);
				render();
				return true;
			case 'ArrowRight':
				cursorX = Math.min(orca.w - 1, cursorX + 1);
				render();
				return true;
			case 'ArrowUp':
				cursorY = Math.max(0, cursorY - 1);
				render();
				return true;
			case 'ArrowDown':
				cursorY = Math.min(orca.h - 1, cursorY + 1);
				render();
				return true;
			case 'Enter':
				if (clock) clock.touch();
				return true;
			case ' ':
				togglePlay();
				return true;
			case 'Delete':
			case 'Backspace':
				// Erase selection or single cell
				if (selectionW !== 0 || selectionH !== 0) {
					// Erase entire selection
					const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
					const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;
					const maxX = cursorX > cursorX + selectionW ? cursorX : cursorX + selectionW;
					const maxY = cursorY > cursorY + selectionH ? cursorY : cursorY + selectionH;

					for (let y = minY; y <= maxY; y++) {
						for (let x = minX; x <= maxX; x++) {
							orca.write(x, y, '.');
						}
					}
					// Reset selection
					selectionW = 0;
					selectionH = 0;
				} else {
					// Erase single cell at cursor
					orca.write(cursorX, cursorY, '.');
				}
				updateNodeData(nodeId, { grid: orca.s });
				render();
				return true;
			default:
				// Type characters into grid
				if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
					const char = e.key; // Preserve case-sensitivity
					if (orca.isAllowed(char)) {
						orca.write(cursorX, cursorY, char);
						updateNodeData(nodeId, { grid: orca.s });
						render();
						return true;
					}
				}
				break;
		}
		return false;
	}

	function handleCanvasMouseDown(e: MouseEvent): void {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const canvasX = (e.clientX - rect.left) / viewport.current.zoom;
		const canvasY = (e.clientY - rect.top) / viewport.current.zoom;
		const x = Math.floor(canvasX / TILE_W);
		const y = Math.floor(canvasY / TILE_H);

		if (orca && x >= 0 && x < orca.w && y >= 0 && y < orca.h) {
			cursorX = x;
			cursorY = y;
			selectionW = 0;
			selectionH = 0;
			mouseFrom = { x, y };
			render();
		}
	}

	function handleCanvasMouseMove(e: MouseEvent): void {
		if (!canvas || !mouseFrom) return;
		const rect = canvas.getBoundingClientRect();
		const canvasX = (e.clientX - rect.left) / viewport.current.zoom;
		const canvasY = (e.clientY - rect.top) / viewport.current.zoom;
		const x = Math.floor(canvasX / TILE_W);
		const y = Math.floor(canvasY / TILE_H);

		if (orca && x >= 0 && x < orca.w && y >= 0 && y < orca.h) {
			selectionW = x - mouseFrom.x;
			selectionH = y - mouseFrom.y;
			render();
		}
	}

	function handleCanvasMouseUp(): void {
		mouseFrom = null;
	}

	// Copy/paste functionality (matching original Orca)
	function getSelection(): string {
		if (!orca) return '';
		const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
		const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;
		const maxX = cursorX > cursorX + selectionW ? cursorX : cursorX + selectionW;
		const maxY = cursorY > cursorY + selectionH ? cursorY : cursorY + selectionH;
		const w = maxX - minX + 1;
		const h = maxY - minY + 1;
		return orca.getBlock(minX, minY, w, h);
	}

	function performCopy(): void {
		if (!orca) return;
		const selection = getSelection();
		navigator.clipboard.writeText(selection).catch((err) => {
			console.error('Failed to copy:', err);
		});
	}

	function performCut(): void {
		if (!orca) return;
		const selection = getSelection();
		navigator.clipboard.writeText(selection).catch((err) => {
			console.error('Failed to copy:', err);
		});

		// Erase selected area
		const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
		const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;
		const maxX = cursorX > cursorX + selectionW ? cursorX : cursorX + selectionW;
		const maxY = cursorY > cursorY + selectionH ? cursorY : cursorY + selectionH;

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				orca.write(x, y, '.');
			}
		}
		updateNodeData(nodeId, { grid: orca.s });
		render();
	}

	async function performPaste(): Promise<void> {
		if (!orca) return;

		try {
			const data = await navigator.clipboard.readText();
			if (!data) return;

			const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
			const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;

			orca.writeBlock(minX, minY, data.trim(), false);
			updateNodeData(nodeId, { grid: orca.s });

			// Update selection to match pasted content
			const lines = data.trim().split(/\r?\n/);
			selectionW = lines[0].length - 1;
			selectionH = lines.length - 1;
			render();
		} catch (err) {
			console.error('Failed to paste:', err);
		}
	}

	function render(): void {
		if (!renderer || !clock) return;

		// Update font scale if it changed
		renderer.updateFontScale(fontSize);

		const selection = { x: cursorX, y: cursorY, w: selectionW, h: selectionH };
		renderer.render(cursorX, cursorY, clock.isPaused, showInterface, showGuide, selection);
	}

	function increaseBpm(): void {
		if (clock) {
			clock.modSpeed(1);
			updateNodeData(nodeId, { bpm: clock.speed.value });
		}
	}

	function decreaseBpm(): void {
		if (clock) {
			clock.modSpeed(-1);
			updateNodeData(nodeId, { bpm: clock.speed.value });
		}
	}

	function clearGrid(): void {
		if (orca) {
			orca.reset(orca.w, orca.h);
			updateNodeData(nodeId, { grid: orca.s, frame: 0 });
			render();
		}
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<!-- Floating title and controls -->
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-lg">
					<div class="font-mono text-xs font-medium text-zinc-400">orca</div>
				</div>

				<div class="flex gap-1">
					<button
						title={isPlaying ? 'Pause' : 'Play'}
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={togglePlay}
					>
						<svelte:component this={isPlaying ? Pause : Play} class="h-4 w-4 text-zinc-300" />
					</button>

					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={() => {
							showSettings = !showSettings;
							measureWidth();
						}}
						title="Settings"
					>
						<Settings class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" title="Control Input" total={1} index={0} nodeId={nodeId} />
				<div class="relative" bind:this={containerElement}>
					<canvas
						bind:this={canvas}
						onkeydown={handleKeyDown}
						onmousedown={handleCanvasMouseDown}
						onmousemove={handleCanvasMouseMove}
						onmouseup={handleCanvasMouseUp}
						tabindex="0"
						role="textbox"
						aria-label="Orca grid editor"
						class={[
							'nodrag cursor-text rounded-md border focus:outline-none',
							selected
								? 'shadow-glow-md border-zinc-400'
								: 'hover:shadow-glow-sm border-transparent'
						].join(' ')}
					></canvas>
				</div>
				<StandardHandle port="outlet" type="message" title="MIDI Output" total={1} index={0} nodeId={nodeId} />
			</div>
		</div>
	</div>

	<!-- Settings Panel -->
	{#if showSettings}
		<div class="absolute" style="left: {previewContainerWidth + 10}px;">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<X class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<div class="space-y-3 p-4">
					<div class="space-y-2">
						<div class="text-xs font-medium text-zinc-400">Grid Settings</div>
						<div class="grid grid-cols-2 gap-2">
							<label class="flex flex-col text-xs text-zinc-400">
								<span>Width:</span>
								<input
									type="number"
									min="4"
									max="256"
									value={orca?.w ?? gridWidth}
									onchange={(e) => {
										const val = parseInt(e.currentTarget.value);
										if (orca && !isNaN(val) && val > 0) {
											// Preserve existing content when resizing
											const oldGrid = orca.s;
											orca.load(val, orca.h, oldGrid, orca.f);
											updateNodeData(nodeId, { width: val, grid: orca.s });
											render();
											measureWidth();
										}
									}}
									class="mt-1 w-full rounded bg-zinc-800 px-2 py-1 text-xs text-white"
								/>
							</label>
							<label class="flex flex-col text-xs text-zinc-400">
								<span>Height:</span>
								<input
									type="number"
									min="4"
									max="256"
									value={orca?.h ?? gridHeight}
									onchange={(e) => {
										const val = parseInt(e.currentTarget.value);
										if (orca && !isNaN(val) && val > 0) {
											// Preserve existing content when resizing
											const oldGrid = orca.s;
											orca.load(orca.w, val, oldGrid, orca.f);
											updateNodeData(nodeId, { height: val, grid: orca.s });
											render();
											measureWidth();
										}
									}}
									class="mt-1 w-full rounded bg-zinc-800 px-2 py-1 text-xs text-white"
								/>
							</label>
						</div>
					</div>

					<div class="space-y-2">
						<div class="text-xs font-medium text-zinc-400">Clock</div>
						<label class="flex flex-col text-xs text-zinc-400">
							<span>BPM:</span>
							<input
								type="number"
								min="60"
								max="300"
								value={bpm}
								onchange={(e) => {
									const val = parseInt(e.currentTarget.value);
									if (clock && !isNaN(val)) {
										clock.setSpeed(val, val);
										updateNodeData(nodeId, { bpm: val });
									}
								}}
								class="mt-1 w-full rounded bg-zinc-800 px-2 py-1 text-xs text-white"
							/>
						</label>
					</div>

					<div class="space-y-2">
						<div class="text-xs font-medium text-zinc-400">Display Options</div>
						<label class="flex items-center gap-2 text-xs text-zinc-400">
							<input
								type="checkbox"
								bind:checked={showInterface}
								onchange={() => render()}
								class="rounded"
							/>
							<span>Show Status Interface</span>
						</label>

						<label class="flex items-center gap-2 text-xs text-zinc-400">
							<input
								type="checkbox"
								bind:checked={showGuide}
								onchange={() => render()}
								class="rounded"
							/>
							<span>Show Operator Guide</span>
						</label>

						<label class="flex flex-col text-xs text-zinc-400">
							<span>Font Size: {fontSize.toFixed(1)}x</span>
							<div class="mt-1 flex items-center gap-2">
								<button
									onclick={() => {
										fontSize = Math.max(0.5, fontSize - 0.1);
										render();
										measureWidth();
									}}
									class="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
								>
									−
								</button>
								<button
									onclick={() => {
										fontSize = Math.min(2.0, fontSize + 0.1);
										render();
										measureWidth();
									}}
									class="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
								>
									+
								</button>
								<span class="flex-1 text-xs text-zinc-500">(Ctrl +/−)</span>
							</div>
						</label>

						<label class="flex flex-col text-xs text-zinc-400">
							<span>Canvas Density: {canvasDensity}x</span>
							<div class="mt-1 flex items-center gap-2">
								<button
									onclick={() => {
										canvasDensity = Math.max(1, canvasDensity - 1);
										if (renderer) renderer.updateCanvasScale(canvasDensity);
										render();
									}}
									class="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
								>
									−
								</button>
								<button
									onclick={() => {
										canvasDensity = Math.min(5, canvasDensity + 1);
										if (renderer) renderer.updateCanvasScale(canvasDensity);
										render();
									}}
									class="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
								>
									+
								</button>
							</div>
						</label>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
