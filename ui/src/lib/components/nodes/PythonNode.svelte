<script lang="ts">
	import { Code, Loader, Play, RefreshCcw, Terminal, Trash2, X } from '@lucide/svelte/icons';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { PyodideSystem } from '$lib/python/PyodideSystem';
	import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
	import type { PyodideConsoleOutputEvent, PyodideSendMessageEvent } from '$lib/eventbus/events';

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
	let consoleOutput = $state<string[]>([]);
	let contentContainer: HTMLDivElement | null = null;
	let contentWidth = $state(100);

	const code = $derived(data.code || '');

	const borderColor = $derived.by(() => {
		if (isRunning) return 'border-orange-500';
		if (selected) return 'border-zinc-400';
		return 'border-zinc-600';
	});

	const playIcon = $derived(isRunning ? Loader : Play);

	function handlePyodideConsoleOutput(event: PyodideConsoleOutputEvent) {
		if (event.nodeId !== nodeId) return;

		const prefix = event.output === 'stderr' ? 'ERROR: ' : '';

		const hasNoReturnValue = event.finished && event.message === null;

		if (!hasNoReturnValue) {
			consoleOutput = [...consoleOutput, `${prefix}${event.message}`];
		}

		updateContentWidth();

		// Mark that the run has completed.
		if (event.finished) {
			isRunning = false;
		}
	}

	function handlePyodideSendMessage(event: PyodideSendMessageEvent) {
		if (event.nodeId !== nodeId) return;

		messageContext.send(event.data, event.options);
	}

	onMount(async () => {
		messageContext = new MessageContext(nodeId);

		// Listen for pyodide console output events
		eventBus.addEventListener('pyodideConsoleOutput', handlePyodideConsoleOutput);
		eventBus.addEventListener('pyodideSendMessage', handlePyodideSendMessage);

		// Initialize pyodide instance
		try {
			await pyodideSystem.create(nodeId);

			isInitialized = true;
		} catch (error) {
			consoleOutput = [
				...consoleOutput,
				`ERROR: failed to setup Python: ${error instanceof Error ? error.message : String(error)}`
			];
		}

		updateContentWidth();
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

		// Clear previous output
		consoleOutput = [];

		try {
			await pyodideSystem.executeCode(nodeId, code);
		} catch (error) {
			consoleOutput = [
				...consoleOutput,
				`ERROR: ${error instanceof Error ? error.message : String(error)}`
			];

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

	function clearConsole() {
		consoleOutput = [];
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
						class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
						onclick={() => {
							updateNodeData(nodeId, { showConsole: !data.showConsole });
							setTimeout(() => updateContentWidth(), 10);
						}}
						title="Console"
					>
						<Terminal class="h-4 w-4 text-zinc-300" />
					</button>

					<button
						class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
						onclick={toggleEditor}
						title="Edit code"
					>
						<Code class="h-4 w-4 text-zinc-300" />
					</button>
				</div>
			</div>

			<div class="relative">
				<div>
					<StandardHandle port="inlet" type="message" title="Input" total={1} index={0} />
				</div>

				{#if data.showConsole}
					<div
						class={[
							'min-w-[150px] rounded-md border bg-zinc-900 p-3',
							borderColor,
							selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
						]}
					>
						<div class="mb-2 flex min-w-[280px] items-center justify-between">
							<span class="font-mono text-[11px] text-zinc-400">console</span>

							<div class="flex gap-1">
								{#if isRunning}
									<button
										onclick={executeCode}
										class="rounded p-1 text-zinc-300 hover:bg-zinc-700"
										title="Run again"
										aria-label="Run again"
									>
										<RefreshCcw size="14px" />
									</button>
								{/if}

								<button
									onclick={executeCode}
									class={[
										'rounded p-1 text-zinc-300 hover:bg-zinc-700',
										isRunning ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
									]}
									title="Run"
									aria-disabled={isRunning}
								>
									<svelte:component
										this={playIcon}
										class={isRunning ? 'animate-spin' : ''}
										size="14px"
									/>
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

						<div
							class="nodrag h-32 max-w-[280px] cursor-text overflow-y-auto rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs"
						>
							{#if consoleOutput.length === 0}
								<div class="italic text-zinc-500">Run your Python code to see results.</div>
							{:else}
								{#each consoleOutput as line}
									<div class="mb-1 whitespace-pre-wrap text-zinc-100">{line}</div>
								{/each}
							{/if}
						</div>
					</div>
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
					<StandardHandle port="outlet" type="message" title="Output" total={1} index={0} />
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
