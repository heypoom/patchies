<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
	import type { ConsoleOutputEvent } from '$lib/eventbus/events';
	import ConsoleMessageLine from './ConsoleMessageLine.svelte';
	import { Copy, Loader, Pause, Play, RefreshCcw, Trash2 } from '@lucide/svelte/icons';
	import { toast } from 'svelte-sonner';

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
	let consoleContainer: HTMLDivElement | null = $state(null);
	let eventBus = PatchiesEventBus.getInstance();
	const { updateNodeData } = useSvelteFlow();

	// Resize state
	let consoleHeight = $state(128); // Default height in pixels (h-32 = 128px)
	let isResizing = $state(false);
	let resizeStartY = $state(0);
	let resizeStartHeight = $state(0);
	const MIN_HEIGHT = 100;
	const MAX_HEIGHT = 600;

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

		// Auto-show console on first error or warning
		if (event.messageType === 'error' || event.messageType === 'warn') {
			updateNodeData(nodeId, { showConsole: true });
		}

		// Auto-scroll to bottom
		setTimeout(() => {
			consoleContainer?.scrollTo({
				top: consoleContainer.scrollHeight,
				behavior: 'smooth'
			});
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
		if (!isResizing) return;
		const deltaY = e.clientY - resizeStartY;
		const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartHeight + deltaY));
		consoleHeight = newHeight;
		onResize?.();
	}

	function stopResize() {
		isResizing = false;
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

		// Add global resize handlers
		window.addEventListener('mousemove', handleResize);
		window.addEventListener('mouseup', stopResize);
	});

	onDestroy(() => {
		eventBus.removeEventListener('consoleOutput', handleConsoleOutput);

		// Remove global resize handlers
		window.removeEventListener('mousemove', handleResize);
		window.removeEventListener('mouseup', stopResize);
	});
</script>

<div
	class={[
		'max-w-[500px] min-w-[150px] rounded-md border bg-zinc-900 p-3',
		borderColor,
		selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm',
		className
	].join(' ')}
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
				<button
					onclick={handleRunOrStop}
					class={[
						'rounded p-1 text-zinc-300 hover:bg-zinc-700',
						isRunning ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
					].join(' ')}
					title={isLongRunningTaskActive ? 'Stop' : 'Run'}
					aria-disabled={isRunning}
				>
					<svelte:component
						this={playOrStopIcon}
						class={isRunning ? 'animate-spin' : ''}
						size="14px"
					/>
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
		<div
			bind:this={consoleContainer}
			role="textbox"
			aria-readonly="true"
			aria-label="Console output"
			tabindex="0"
			class="nodrag nopan nowheel cursor-text overflow-y-auto rounded border border-zinc-700 bg-zinc-800 font-mono text-xs select-text"
			style="height: {consoleHeight}px;"
			oncopy={(e) => e.stopPropagation()}
			oncut={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				// Stop keyboard events from bubbling to XYFlow
				// This prevents Ctrl/Cmd+C from triggering node copy
				if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
					e.stopPropagation();
				}
				if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
					e.stopPropagation();
				}
			}}
			onfocus={(e) => {
				// When console gets focus, it means user is interacting with it
				e.stopPropagation();
			}}
			onmousedown={(e) => {
				// Prevent XYFlow from treating this as a node interaction
				e.stopPropagation();
			}}
		>
			{#if messages.length === 0}
				<div class="p-2 text-zinc-500 italic">{placeholder}</div>
			{:else}
				{#each messages as msg}
					<ConsoleMessageLine {msg} />
				{/each}
			{/if}
		</div>

		<!-- Resize handle -->
		<button
			class="nodrag nopan absolute right-0 bottom-0 left-0 h-2 cursor-ns-resize border-0 bg-transparent p-0 transition-colors hover:bg-zinc-600/30"
			onmousedown={startResize}
			type="button"
			aria-label="Resize console"
		>
			<div
				class="absolute top-1/2 left-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-600"
			></div>
		</button>
	</div>
</div>
