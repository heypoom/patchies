<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
	import type { ConsoleOutputEvent } from '$lib/eventbus/events';
	import ConsoleMessageLine from './ConsoleMessageLine.svelte';
	import { Copy, Loader, Pause, Play, RefreshCcw, Trash2 } from '@lucide/svelte/icons';
	import { toast } from 'svelte-sonner';
	import { VList } from 'virtua/svelte';

	let {
		nodeId,
		maxHeight = '200px',
		minHeight = '100px',
		placeholder = 'Run your code to see output.',
		class: className = '',
		borderColor = 'border-zinc-700',
		selected = false,
		onrun,
		isRunning = false,
		isLongRunningTaskActive = false,
		playOrStopIcon,
		runOrStop,
		onResize
	}: {
		nodeId: string;
		maxHeight?: string;
		minHeight?: string;
		placeholder?: string;
		class?: string;
		borderColor?: string;
		selected?: boolean;
		onrun?: () => void;
		isRunning?: boolean;
		isLongRunningTaskActive?: boolean;
		playOrStopIcon?: any;
		runOrStop?: () => void;
		onResize?: () => void;
	} = $props();

	let messages = $state<Array<{ type: string; timestamp: number; args: unknown[] }>>([]);
	let vlistRef: any = $state(null);
	let consoleContainer: HTMLDivElement | null = $state(null);
	let eventBus = PatchiesEventBus.getInstance();
	const { updateNodeData } = useSvelteFlow();

	// Resize state - vertical
	let consoleHeight = $state(128); // Default height in pixels (h-32 = 128px)
	let isResizing = $state(false);
	let resizeStartY = $state(0);
	let resizeStartHeight = $state(0);
	const MIN_HEIGHT = 100;
	const MAX_HEIGHT = 1000;

	// Resize state - horizontal
	let consoleWidth = $state<number | null>(null); // null = auto-size, number = fixed width
	let isHorizontalResizing = $state(false);
	let resizeStartX = $state(0);
	let resizeStartWidth = $state(0);
	const MIN_WIDTH = 300;
	const MAX_WIDTH = 1000;

	// Resize state - corner (both vertical and horizontal)
	let isCornerResizing = $state(false);

	const MAX_MESSAGES = 1000; // Limit stored messages to prevent unbounded growth

	function handleConsoleOutput(event: ConsoleOutputEvent) {
		if (event.nodeId !== nodeId) return;

		messages = [
			...messages,
			{
				type: event.messageType,
				timestamp: event.timestamp,
				args: event.args
			}
		];

		// Keep only the last MAX_MESSAGES to prevent unbounded growth
		if (messages.length > MAX_MESSAGES) {
			messages = messages.slice(-MAX_MESSAGES);
		}

		// Auto-show console on first error or warning
		if (event.messageType === 'error' || event.messageType === 'warn') {
			updateNodeData(nodeId, { showConsole: true });
		}

		// Auto-scroll to bottom using VList's scrollToIndex
		setTimeout(() => {
			if (vlistRef) {
				vlistRef.scrollToIndex(messages.length - 1, { smooth: true, align: 'end' });
			}
		}, 10);
	}

	export function clearConsole() {
		messages = [];
	}

	function copyOutput() {
		// Format all messages as plain text
		const text = messages
			.map((msg) => {
				const prefix = msg.type === 'error' ? '[ERROR] ' : msg.type === 'warn' ? '[WARN] ' : '';
				const content = msg.args
					.map((arg) => {
						if (arg === null) return 'null';
						if (arg === undefined) return 'undefined';
						if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
							return String(arg);
						}
						try {
							return JSON.stringify(arg, null, 2);
						} catch {
							return String(arg);
						}
					})
					.join(' ');
				return prefix + content;
			})
			.join('\n');

		// Copy to clipboard
		navigator.clipboard.writeText(text).then(() => {
			toast.success('Console output copied to clipboard');
		});
	}

	function startResize(e: MouseEvent) {
		isResizing = true;
		resizeStartY = e.clientY;
		resizeStartHeight = consoleHeight;
		e.preventDefault();
		e.stopPropagation();
	}

	function handleResize(e: MouseEvent) {
		// Handle vertical resize
		if (isResizing) {
			const deltaY = e.clientY - resizeStartY;
			const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartHeight + deltaY));
			consoleHeight = newHeight;
			onResize?.();
		}

		// Handle horizontal resize
		if (isHorizontalResizing) {
			const deltaX = e.clientX - resizeStartX;
			const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth + deltaX));
			consoleWidth = newWidth;
			onResize?.();
		}

		// Handle corner resize (both at once)
		if (isCornerResizing) {
			const deltaY = e.clientY - resizeStartY;
			const deltaX = e.clientX - resizeStartX;
			const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartHeight + deltaY));
			const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth + deltaX));
			consoleHeight = newHeight;
			consoleWidth = newWidth;
			onResize?.();
		}
	}

	function stopResize() {
		isResizing = false;
		isHorizontalResizing = false;
		isCornerResizing = false;
	}

	// Horizontal resize handlers
	function startHorizontalResize(e: MouseEvent) {
		isHorizontalResizing = true;
		resizeStartX = e.clientX;

		// Capture current actual width
		resizeStartWidth = consoleContainer?.offsetWidth || MIN_WIDTH;

		// Switch to fixed width mode
		if (consoleWidth === null) {
			consoleWidth = resizeStartWidth;
		}

		e.preventDefault();
		e.stopPropagation();
	}

	// Corner resize handler
	function startCornerResize(e: MouseEvent) {
		isCornerResizing = true;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;

		// Capture current actual dimensions
		resizeStartWidth = consoleContainer?.offsetWidth || MIN_WIDTH;
		resizeStartHeight = consoleHeight;

		// Switch to fixed width mode
		if (consoleWidth === null) {
			consoleWidth = resizeStartWidth;
		}

		e.preventDefault();
		e.stopPropagation();
	}

	// Touch event handlers for mobile support
	function startTouchResize(e: TouchEvent) {
		if (e.touches.length !== 1) return;

		isResizing = true;

		resizeStartY = e.touches[0].clientY;
		resizeStartHeight = consoleHeight;

		e.preventDefault();
		e.stopPropagation();
	}

	function handleTouchResize(e: TouchEvent) {
		if (e.touches.length !== 1) return;

		// Handle vertical resize
		if (isResizing) {
			const deltaY = e.touches[0].clientY - resizeStartY;
			const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartHeight + deltaY));
			consoleHeight = newHeight;
			onResize?.();
		}

		// Handle horizontal resize
		if (isHorizontalResizing) {
			const deltaX = e.touches[0].clientX - resizeStartX;
			const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth + deltaX));
			consoleWidth = newWidth;
			onResize?.();
		}

		// Handle corner resize
		if (isCornerResizing) {
			const deltaY = e.touches[0].clientY - resizeStartY;
			const deltaX = e.touches[0].clientX - resizeStartX;
			const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartHeight + deltaY));
			const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth + deltaX));
			consoleHeight = newHeight;
			consoleWidth = newWidth;
			onResize?.();
		}
	}

	function stopTouchResize() {
		isResizing = false;
		isHorizontalResizing = false;
		isCornerResizing = false;
	}

	// Touch horizontal resize handlers for mobile
	function startTouchHorizontalResize(e: TouchEvent) {
		if (e.touches.length !== 1) return;

		isHorizontalResizing = true;

		resizeStartX = e.touches[0].clientX;
		// Capture current actual width
		resizeStartWidth = consoleContainer?.offsetWidth || MIN_WIDTH;
		// Switch to fixed width mode
		if (consoleWidth === null) {
			consoleWidth = resizeStartWidth;
		}

		e.preventDefault();
		e.stopPropagation();
	}

	// Touch corner resize handler for mobile
	function startTouchCornerResize(e: TouchEvent) {
		if (e.touches.length !== 1) return;

		isCornerResizing = true;

		resizeStartX = e.touches[0].clientX;
		resizeStartY = e.touches[0].clientY;
		// Capture current actual dimensions
		resizeStartWidth = consoleContainer?.offsetWidth || MIN_WIDTH;
		resizeStartHeight = consoleHeight;
		// Switch to fixed width mode
		if (consoleWidth === null) {
			consoleWidth = resizeStartWidth;
		}

		e.preventDefault();
		e.stopPropagation();
	}

	function handleRun() {
		clearConsole();
		onrun?.();
	}

	function handleRunOrStop() {
		// Only clear console when running (not when stopping)
		if (!isLongRunningTaskActive) {
			clearConsole();
		}

		runOrStop?.();
	}

	onMount(() => {
		eventBus.addEventListener('consoleOutput', handleConsoleOutput);

		// Add global resize handlers (handles both vertical and horizontal)
		window.addEventListener('mousemove', handleResize);
		window.addEventListener('mouseup', stopResize);

		// Add touch resize handlers for mobile (handles both vertical and horizontal)
		window.addEventListener('touchmove', handleTouchResize, { passive: false });
		window.addEventListener('touchend', stopTouchResize);
		window.addEventListener('touchcancel', stopTouchResize);
	});

	onDestroy(() => {
		eventBus.removeEventListener('consoleOutput', handleConsoleOutput);

		// Remove global resize handlers
		window.removeEventListener('mousemove', handleResize);
		window.removeEventListener('mouseup', stopResize);

		// Remove touch resize handlers
		window.removeEventListener('touchmove', handleTouchResize);
		window.removeEventListener('touchend', stopTouchResize);
		window.removeEventListener('touchcancel', stopTouchResize);
	});
</script>

<div
	bind:this={consoleContainer}
	class={[
		'rounded-md border bg-zinc-900 p-3',
		borderColor,
		selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm',
		className
	].join(' ')}
	style="
		{consoleWidth !== null ? `width: ${consoleWidth}px;` : 'width: fit-content;'}
		max-width: {MAX_WIDTH}px;
		min-width: {MIN_WIDTH}px;
	"
>
	<div class="mb-2 flex min-w-[280px] items-center justify-between">
		<span class="font-mono text-[11px] text-zinc-400">console</span>

		<div class="flex gap-1">
			{#if (isRunning || isLongRunningTaskActive) && onrun}
				<button
					onclick={handleRun}
					class="rounded p-1 text-zinc-300 hover:bg-zinc-700"
					title="Run again"
					aria-label="Run again"
				>
					<RefreshCcw size="14px" />
				</button>
			{/if}

			{#if runOrStop && playOrStopIcon}
				{@const PlayOrStopIconComponent = playOrStopIcon}

				<button
					onclick={handleRunOrStop}
					class={[
						'rounded p-1 text-zinc-300 hover:bg-zinc-700',
						isRunning ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
					].join(' ')}
					title={isLongRunningTaskActive ? 'Stop' : 'Run'}
					aria-label={isLongRunningTaskActive ? 'Stop' : 'Run'}
					aria-disabled={isRunning}
				>
					<PlayOrStopIconComponent class={isRunning ? 'animate-spin' : ''} size="14px" />
				</button>
			{/if}

			<button
				onclick={copyOutput}
				class="rounded p-1 text-zinc-300 hover:bg-zinc-700"
				title="Copy output"
				aria-label="Copy output"
			>
				<Copy size="14px" />
			</button>

			<button
				onclick={clearConsole}
				class="rounded p-1 text-zinc-300 hover:bg-zinc-700"
				title="Clear console"
			>
				<Trash2 size="14px" />
			</button>
		</div>
	</div>

	<div class="relative">
		{#if messages.length === 0}
			<div
				class="nodrag nopan nowheel cursor-text rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs text-zinc-500 italic select-text"
				style="height: {consoleHeight}px;"
			>
				{placeholder}
			</div>
		{:else}
			<div
				class="nodrag nopan nowheel cursor-text rounded border border-zinc-700 bg-zinc-800 font-mono text-xs select-text"
				style="height: {consoleHeight}px;"
				oncopy={(e: ClipboardEvent) => e.stopPropagation()}
				oncut={(e: ClipboardEvent) => e.stopPropagation()}
				onkeydown={(e: KeyboardEvent) => {
					// Stop keyboard events from bubbling to XYFlow
					if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
						e.stopPropagation();
					}
					if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
						e.stopPropagation();
					}
				}}
				onfocus={(e: FocusEvent) => {
					e.stopPropagation();
				}}
				onmousedown={(e: MouseEvent) => {
					e.stopPropagation();
				}}
				role="textbox"
				aria-readonly="true"
				aria-label="Console output"
				tabindex="0"
			>
				<VList bind:this={vlistRef} data={messages} getKey={(_: any, i: number) => i}>
					{#snippet children(msg: any)}
						<ConsoleMessageLine {msg} />
					{/snippet}
				</VList>
			</div>
		{/if}

		<!-- Vertical resize handle -->
		<button
			class="nodrag nopan absolute right-0 bottom-0 left-0 h-2 cursor-ns-resize border-0 bg-transparent p-0 transition-colors hover:bg-zinc-600/30"
			onmousedown={startResize}
			ontouchstart={startTouchResize}
			type="button"
			aria-label="Resize console vertically"
		>
			<div
				class="absolute top-1/2 left-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-600"
			></div>
		</button>

		<!-- Horizontal resize handle -->
		<button
			class="nodrag nopan absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize border-0 bg-transparent p-0 transition-colors hover:bg-zinc-600/30"
			onmousedown={startHorizontalResize}
			ontouchstart={startTouchHorizontalResize}
			type="button"
			aria-label="Resize console horizontally"
		>
			<div
				class="absolute top-1/2 left-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-600"
			></div>
		</button>

		<!-- Corner resize handle (bottom-right) -->
		<button
			class="nodrag nopan absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize border-0 bg-transparent p-0 transition-colors hover:bg-zinc-600/30"
			onmousedown={startCornerResize}
			ontouchstart={startTouchCornerResize}
			type="button"
			aria-label="Resize console both vertically and horizontally"
		>
			<div
				class="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-600"
			></div>
		</button>
	</div>
</div>
