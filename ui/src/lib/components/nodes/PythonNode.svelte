<script lang="ts">
	import { Code, Loader, Play, Terminal, X } from '@lucide/svelte/icons';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { PyodideSystem } from '$lib/python/PyodideSystem';
	import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
	import type { PyodideConsoleOutputEvent, PyodideSendMessageEvent } from '$lib/eventbus/events';
	import VirtualConsole from '$lib/components/VirtualConsole.svelte';
	import { logger } from '$lib/utils/logger';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			code: string;
			showConsole?: boolean;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let pyodideSystem = PyodideSystem.getInstance();
	let eventBus = PatchiesEventBus.getInstance();
	let isInitialized = $state(false);
	let isRunning = $state(false);
	let showEditor = $state(false);
	let consoleRef: VirtualConsole | null = $state(null);
	let contentContainer: HTMLDivElement | null = null;
	let contentWidth = $state(100);

	const nodeLogger = logger.ofNode(nodeId);

	const code = $derived(data.code || '');

	const borderColor = $derived.by(() => {
		if (isRunning) return 'border-orange-500';
		if (selected) return 'border-zinc-400';
		return 'border-zinc-600';
	});

	const playIcon = $derived(isRunning ? Loader : Play);

	function handlePyodideConsoleOutput(event: PyodideConsoleOutputEvent) {
		if (event.nodeId !== nodeId) return;

		const hasNoReturnValue = event.finished && event.message === null;

		if (!hasNoReturnValue && event.message) {
			if (event.output === 'stderr') {
				nodeLogger.error(event.message);
			} else {
				nodeLogger.log(event.message);
			}
		}

		// Mark that the run has completed.
		if (event.finished) {
			isRunning = false;
		}
	}

	function handlePyodideSendMessage(event: PyodideSendMessageEvent) {
		if (event.nodeId !== nodeId) return;

		messageContext.send(event.data, event.options);
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);

		// Listen for pyodide console output events
		eventBus.addEventListener('pyodideConsoleOutput', handlePyodideConsoleOutput);
		eventBus.addEventListener('pyodideSendMessage', handlePyodideSendMessage);

		// Initialize pyodide instance
		try {
			pyodideSystem.create(nodeId).then(() => {
				isInitialized = true;
			});
		} catch (error) {
			nodeLogger.error(
				`Failed to setup Python: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		updateContentWidth();

		// Watch for any size changes to the content container
		const resizeObserver = new ResizeObserver(() => {
			updateContentWidth();
		});

		if (contentContainer) {
			resizeObserver.observe(contentContainer);
		}

		return () => {
			resizeObserver.disconnect();
		};
	});

	onDestroy(async () => {
		eventBus.removeEventListener('pyodideConsoleOutput', handlePyodideConsoleOutput);
		eventBus.removeEventListener('pyodideSendMessage', handlePyodideSendMessage);

		if (isInitialized) {
			await pyodideSystem.delete(nodeId);
		}
		messageContext?.destroy();
	});

	async function executeCode() {
		if (!isInitialized || isRunning) return;

		isRunning = true;

		// Clear previous console output
		consoleRef?.clearConsole();

		try {
			await pyodideSystem.executeCode(nodeId, code);
		} catch (error) {
			nodeLogger.error(error instanceof Error ? error.message : String(error));

			isRunning = false;
		}
	}

	function updateContentWidth() {
		if (!contentContainer) return;
		contentWidth = contentContainer.offsetWidth;
	}

	function toggleEditor() {
		showEditor = !showEditor;
	}
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2" bind:this={contentContainer}>
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-400">python</div>
				</div>

				<div>
					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={() => {
							updateNodeData(nodeId, { showConsole: !data.showConsole });
							setTimeout(() => updateContentWidth(), 10);
						}}
						title="Console"
					>
						<Terminal class="h-4 w-4 text-zinc-300" />
					</button>

					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={toggleEditor}
						title="Edit code"
					>
						<Code class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<div>
					<StandardHandle port="inlet" type="message" title="Input" total={1} index={0} {nodeId} />
				</div>

				{#if data.showConsole}
					<VirtualConsole
						bind:this={consoleRef}
						{nodeId}
						{borderColor}
						{selected}
						onrun={executeCode}
						{isRunning}
						playOrStopIcon={playIcon}
						runOrStop={executeCode}
					/>
				{:else}
					<button
						class={[
							'flex w-full min-w-[100px] justify-center rounded-md border bg-zinc-900 py-3 text-zinc-300 hover:bg-zinc-800',
							isRunning ? 'cursor-not-allowed' : 'cursor-pointer',
							borderColor,
							selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
						]}
						onclick={executeCode}
						aria-disabled={isRunning}
						aria-label="Run Python code"
					>
						<div class={[isRunning ? 'animate-spin opacity-30' : '']}>
							<svelte:component this={playIcon} size="16px" />
						</div>
					</button>
				{/if}

				<div>
					<StandardHandle
						port="outlet"
						type="message"
						title="Output"
						total={1}
						index={0}
						{nodeId}
					/>
				</div>
			</div>
		</div>
	</div>

	{#if showEditor}
		<div class="absolute" style="left: {contentWidth + 10}px">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
					<X class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
				<CodeEditor
					value={code}
					onchange={(newCode) => {
						updateNodeData(nodeId, { code: newCode });
					}}
					language="python"
					placeholder="Write your Python code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={executeCode}
				/>
			</div>
		</div>
	{/if}
</div>
