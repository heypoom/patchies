<script lang="ts">
	import {
		Code,
		Loader,
		Package,
		Pause,
		Play,
		RefreshCcw,
		Terminal,
		Trash2,
		X
	} from '@lucide/svelte/icons';
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { JSRunner } from '$lib/js-runner/JSRunner';
	import { match, P } from 'ts-pattern';

	let contentContainer: HTMLDivElement | null = null;
	let consoleContainer: HTMLDivElement | null = $state(null);

	// Get node data from XY Flow - nodes receive their data as props
	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			title?: string;
			code: string;
			showConsole?: boolean;
			runOnMount?: boolean;
			inletCount?: number;
			outletCount?: number;
			libraryName?: boolean;
			executeCode?: number;
		};
		selected: boolean;
	} = $props();

	// Get flow utilities to update node data
	const { updateNodeData } = useSvelteFlow();

	const updateNodeInternals = useUpdateNodeInternals();

	const jsRunner = JSRunner.getInstance();
	let isRunning = $state(false);
	let isMessageCallbackActive = $state(false);
	let isTimerCallbackActive = $state(false);
	let isLongRunningTaskActive = $derived(isMessageCallbackActive || isTimerCallbackActive);
	let inletCount = $derived(data.inletCount ?? 1);
	let outletCount = $derived(data.outletCount ?? 1);

	let showEditor = $state(false);
	let consoleOutput = $state<string[]>([]);
	let contentWidth = $state(100);

	const code = $derived(data.code || '');
	
	// Watch for executeCode timestamp changes and re-run when it changes
	$effect(() => {
		if (data.executeCode) {
			executeCode();
		}
	});

	const borderColor = $derived.by(() => {
		if (isRunning && selected) return 'border-pink-300';
		if (isRunning) return 'border-pink-500';
		if (isLongRunningTaskActive && selected) return 'border-emerald-300';
		if (isLongRunningTaskActive) return 'border-emerald-500';
		if (selected) return 'border-zinc-400';

		return 'border-zinc-600';
	});

	const playOrStopIcon = $derived.by(() => {
		if (data.libraryName) return Package;

		if (isRunning) return Loader;
		if (isLongRunningTaskActive) return Pause;

		return Play;
	});

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					updateNodeData(nodeId, { code });
				})
				.with({ type: 'run' }, () => {
					executeCode();
				})
				.with({ type: 'stop' }, () => {
					stopLongRunningTasks();
				});
		} catch (error) {
			consoleOutput = [
				...consoleOutput,
				`ERROR: ${error instanceof Error ? error.message : String(error)}`
			];
		}
	};

	onMount(() => {
		const messageContext = jsRunner.getMessageContext(nodeId);
		messageContext.onMessageCallbackRegistered = () => {
			isMessageCallbackActive = true;
		};
		messageContext.onIntervalCallbackRegistered = () => {
			isTimerCallbackActive = true;
		};
		messageContext.onAnimationFrameCallbackRegistered = () => {
			isTimerCallbackActive = true;
		};
		messageContext.queue.addCallback(handleMessage);

		// libraries should be run on mount to register themselves
		if (data.runOnMount || data.libraryName) {
			executeCode();
		}

		updateContentWidth();
	});

	onDestroy(() => {
		const messageContext = jsRunner.getMessageContext(nodeId);
		messageContext.queue.removeCallback(handleMessage);

		jsRunner.destroy(nodeId);
	});

	function clearTimers() {
		const messageContext = jsRunner.getMessageContext(nodeId);
		messageContext.clearTimers();
		isTimerCallbackActive = false;
	}

	function clearMessageHandler() {
		const messageContext = jsRunner.getMessageContext(nodeId);
		messageContext.messageCallback = null;
		isMessageCallbackActive = false;
	}

	function stopLongRunningTasks() {
		clearTimers();
		clearMessageHandler();
	}

	// Keep the console scrolled to the bottom and update width
	function syncConsoleUi() {
		setTimeout(() => {
			updateContentWidth();

			consoleContainer?.scrollTo({
				left: 0,
				top: consoleContainer.scrollHeight,
				behavior: 'instant'
			});
		}, 50);
	}

	async function executeCode() {
		isRunning = true;
		isMessageCallbackActive = false;
		isTimerCallbackActive = false;

		// Clear previous output
		consoleOutput = [];

		// Create a custom console that captures output
		const customConsole = {
			log: (...args: any[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');

				consoleOutput = [...consoleOutput, message];

				syncConsoleUi();
			},
			error: (...args: any[]) => {
				const message = args.map((arg) => String(arg)).join(' ');
				consoleOutput = [...consoleOutput, `ERROR: ${message}`];

				syncConsoleUi();
			},
			warn: (...args: any[]) => {
				const message = args.map((arg) => String(arg)).join(' ');
				consoleOutput = [...consoleOutput, `WARN: ${message}`];

				syncConsoleUi();
			}
		};

		const setPortCount = (inletCount = 1, outletCount = 1) => {
			updateNodeData(nodeId, { inletCount, outletCount });
			updateNodeInternals(nodeId);
		};

		const setRunOnMount = (runOnMount = true) => updateNodeData(nodeId, { runOnMount });

		try {
			const processedCode = await jsRunner.preprocessCode(code, {
				nodeId,
				setLibraryName: (libraryName: string | null) => {
					updateNodeData(nodeId, { libraryName, inletCount: 0, outletCount: 0 });

					setTimeout(() => {
						updateContentWidth();
					}, 10);
				}
			});

			// library code - do not execute
			if (processedCode === null) return;

			await jsRunner.executeJavaScript(nodeId, processedCode, {
				customConsole,
				setPortCount,
				setRunOnMount,
				setTitle
			});
		} catch (error) {
			consoleOutput = [
				...consoleOutput,
				`ERROR: ${error instanceof Error ? error.message : String(error)}`
			];
		} finally {
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

	function runOrStop() {
		if (isLongRunningTaskActive) {
			stopLongRunningTasks();
		} else {
			executeCode();
		}
	}

	function setTitle(title: string) {
		updateNodeData(nodeId, { title });
	}

	function handleDoubleClickOnRun() {
		if (data.libraryName) {
			toggleEditor();
		}
	}

	let minContainerWidth = $derived.by(() => {
		const baseWidth = 70;
		let inletWidth = 15;

		return baseWidth + Math.max(Math.max(inletCount, 2), Math.max(outletCount, 2)) * inletWidth;
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2" bind:this={contentContainer}>
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 w-fit rounded-lg bg-zinc-900/70 px-2 py-1 backdrop-blur-lg">
					<div class="font-mono text-xs font-medium text-zinc-400">
						{data.libraryName ?? data.title ?? 'js'}
					</div>
				</div>

				<div>
					{#if !data.libraryName}
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
					{/if}

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
					{#each Array.from({ length: inletCount }) as _, index (index)}
						<StandardHandle
							port="inlet"
							id={index}
							title={`Inlet ${index}`}
							total={inletCount}
							{index}
							class="top-0"
						/>
					{/each}
				</div>

				{#if data.showConsole && !data.libraryName}
					<div
						class={[
							'max-w-[500px] min-w-[150px] rounded-md border bg-zinc-900 p-3',
							borderColor,
							selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
						]}
					>
						<div class="mb-2 flex min-w-[280px] items-center justify-between">
							<span class="font-mono text-[11px] text-zinc-400">console</span>

							<div class="flex gap-1">
								{#if isRunning || isLongRunningTaskActive}
									<button
										onclick={executeCode}
										class="rounded p-1 text-zinc-300 hover:bg-zinc-700"
										title="Run again"
										aria-label="Run again"
									>
										<RefreshCcw font-size="12px" />
									</button>
								{/if}

								<button
									onclick={runOrStop}
									class={[
										'rounded p-1 text-zinc-300 hover:bg-zinc-700',
										isRunning ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
									]}
									title={isLongRunningTaskActive ? 'Stop' : 'Run'}
									aria-disabled={isRunning}
								>
									<svelte:component
										this={playOrStopIcon}
										class={isRunning ? 'animate-spin' : ''}
										font-size="12px"
									/>
								</button>

								<button
									onclick={clearConsole}
									class="rounded p-1 text-zinc-300 hover:bg-zinc-700"
									title="Clear console"
								>
									<Trash2 font-size="12px" />
								</button>
							</div>
						</div>

						<div
							class="nodrag h-32 cursor-text overflow-y-auto rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs"
							bind:this={consoleContainer}
						>
							{#if consoleOutput.length === 0}
								<div class="text-zinc-500 italic">Run your code to see results.</div>
							{:else}
								{#each consoleOutput as line, index (index)}
									<div class="mb-1 whitespace-pre-wrap text-zinc-100 select-text">{line}</div>
								{/each}
							{/if}
						</div>
					</div>
				{:else}
					<button
						class={[
							'flex w-full justify-center rounded-md border py-3 text-zinc-300 hover:bg-zinc-700',
							isRunning ? 'cursor-not-allowed' : 'cursor-pointer',
							borderColor,
							selected ? 'shadow-glow-md bg-zinc-800' : 'hover:shadow-glow-sm bg-zinc-900'
						]}
						style={`min-width: ${minContainerWidth}px`}
						onclick={runOrStop}
						ondblclick={(e) => {
							e.preventDefault();
							e.stopPropagation();

							handleDoubleClickOnRun();
						}}
						aria-disabled={isRunning}
						aria-label="Run code"
					>
						<div class={[isRunning ? 'animate-spin opacity-30' : '']}>
							<svelte:component this={playOrStopIcon} />
						</div>
					</button>

					<div
						class={[
							'pointer-events-none absolute mt-1 ml-1 w-fit min-w-[200px] font-mono text-[8px] text-zinc-300 opacity-0',
							selected ? '' : 'group-hover:opacity-100'
						]}
					>
						{#if data.libraryName}
							{#if !showEditor}
								<div>double click to edit shared code</div>
							{/if}
						{:else}
							<div>click to run</div>
						{/if}
					</div>
				{/if}

				<div>
					{#each Array.from({ length: outletCount }) as _, index (index)}
						<StandardHandle
							port="outlet"
							id={index}
							title={`Outlet ${index}`}
							total={outletCount}
							{index}
							class="bottom-0"
						/>
					{/each}
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
						if (data.libraryName) {
							jsRunner.setLibraryCode(nodeId, newCode);
						}

						updateNodeData(nodeId, { code: newCode });
					}}
					language="javascript"
					nodeType="js"
					placeholder="Write your JavaScript code here..."
					class="nodrag h-64 w-full resize-none"
					onrun={executeCode}
				/>
			</div>
		</div>
	{/if}
</div>
