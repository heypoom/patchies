<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AssemblySystem } from './AssemblySystem';
	import AssemblyEditor from './AssemblyEditor.svelte';
	import MachineStateViewer from './MachineStateViewer.svelte';
	import type { InspectedMachine, Effect, Message, MachineConfig } from './AssemblySystem';
	import { memoryActions } from './memoryStore';
	import Icon from '@iconify/svelte';
	import PaginatedMemoryViewer from './PaginatedMemoryViewer.svelte';

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
			showMemoryViewer?: boolean;
			machineConfig?: MachineConfig;
		};
		selected?: boolean;
	} = $props();

	let assemblySystem = AssemblySystem.getInstance();
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let machineState = $state<InspectedMachine | null>(null);
	let logs = $state<string[]>([]);
	let dragEnabled = $state(true);
	let showSettings = $state(false);
	let mainContainer: HTMLDivElement;
	let highlightLineCallback: ((lineNo: number) => void) | null = null;

	const { updateNodeData } = useSvelteFlow();

	let inletCount = $derived(data.inletCount ?? 3);
	let outletCount = $derived(data.outletCount ?? 3);

	// Use node data as single source of truth for machine config
	const machineConfig = $derived(
		data.machineConfig || { isRunning: false, delayMs: 100, stepBy: 1 }
	);

	let previewContainerWidth = $state(0);
	let updateInterval: NodeJS.Timeout | number;

	// Machine ID is derived from node ID
	const machineId = parseInt(nodeId.replace(/\D/g, '')) || 0;

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { code: newCode });

		setTimeout(() => reloadProgram(true));
	};

	const toggleMemoryViewer = () =>
		updateNodeData(nodeId, { showMemoryViewer: !data.showMemoryViewer });

	const handleMessage: MessageCallbackFn = async (message, meta) => {
		try {
			await match(message)
				.with({ type: 'bang' }, () => stepMachine())
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, () => reloadProgram(true))
				.with({ type: 'play' }, () => playMachine())
				.with({ type: 'pause' }, () => pauseMachine())
				.with({ type: 'toggle' }, () => togglePlayPause())
				.with({ type: 'reset' }, () => resetMachine())
				.with({ type: 'step' }, () => stepMachine())
				.with({ type: 'setDelayMs', value: P.number }, ({ value }) =>
					updateMachineConfig({ delayMs: value })
				)
				.with({ type: 'setStepBy', value: P.number }, ({ value }) =>
					updateMachineConfig({ stepBy: value })
				)
				.with(P.union(P.number, P.array(P.number)), async (m) => {
					if (meta.inlet === undefined) return;

					const sourceIdStr = meta.source.match(/\w+-(\d)/)?.[1] ?? '';
					let source = 0;

					if (parseInt(sourceIdStr) >= 0) {
						source = parseInt(sourceIdStr);
					}

					await assemblySystem.sendMessage(machineId, m, source, meta.inlet);
				})
				.otherwise(() => {
					// Unknown message type
				});
		} catch (error) {
			displayError(error);
		}
	};

	async function resetMachine() {
		logs = [];

		try {
			await assemblySystem.resetMachine(machineId);
			await assemblySystem.loadProgram(machineId, data.code);

			await syncMachineState();

			memoryActions.refreshMemory(machineId);
			errorMessage = null;
		} catch (error) {
			displayError(error);
		}
	}

	async function stepMachine() {
		try {
			await assemblySystem.stepMachine(machineId, machineConfig.stepBy);

			await syncMachineState();
			memoryActions.refreshMemory(machineId);
		} catch (error) {
			if (
				error &&
				typeof error === 'object' &&
				'type' in error &&
				error.type === 'MachineDoesNotExist'
			) {
				await assemblySystem.createMachineWithId(machineId);
				await assemblySystem.loadProgram(machineId, data.code);
				await assemblySystem.stepMachine(machineId, machineConfig.stepBy);
				await pullMachineConfig();
			} else {
				displayError(error);
			}
		}
	}

	async function pullMachineConfig() {
		const nextConfig = await assemblySystem.getMachineConfig(machineId);

		updateNodeData(nodeId, { machineConfig: nextConfig });
	}

	async function pauseMachine() {
		try {
			const state = await assemblySystem.inspectMachine(machineId);

			await assemblySystem.pauseMachine(machineId);

			// If machine is stuck in awaiting state, pausing should reset it.
			if (state?.status === 'Awaiting') {
				resetMachine();
			}

			await pullMachineConfig();

			clearInterval(updateInterval);
		} catch (error) {
			displayError(error);
		}
	}

	async function playMachine() {
		try {
			// Ensure machine exists and has a program loaded
			if (!(await assemblySystem.machineExists(machineId))) {
				await assemblySystem.createMachineWithId(machineId);
			}

			// Check if machine has a program loaded by inspecting its state
			const currentState = await assemblySystem.inspectMachine(machineId);

			if (!currentState || currentState.status === 'Halted') {
				await assemblySystem.loadProgram(machineId, data.code);
			}

			await assemblySystem.playMachine(machineId);

			await setupPolling();
		} catch (error) {
			displayError(error);
		}
	}

	async function togglePlayPause() {
		if (machineConfig.isRunning) {
			await pauseMachine();
		} else {
			await playMachine();
		}
	}

	function updateMachineConfig(nextConfig: Partial<MachineConfig>) {
		const mergedConfig = { ...machineConfig, ...nextConfig };

		assemblySystem.setMachineConfig(machineId, mergedConfig);
		updateNodeData(nodeId, { machineConfig: mergedConfig });
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		pushMachineConfig();
		setupPolling();
		measureContainerWidth();
		reloadProgram(false);
	});

	async function pushMachineConfig() {
		async () => {
			try {
				if (data.machineConfig) {
					await assemblySystem.setMachineConfig(machineId, data.machineConfig);
				}

				pullMachineConfig();
			} catch (error) {
				// Use default config if unable to load
			}
		};
	}

	async function setupPolling() {
		clearInterval(updateInterval);

		await pullMachineConfig();

		if (!machineConfig.isRunning) return;

		updateInterval = setInterval(async () => {
			await syncMachineState();

			memoryActions.refreshMemory(machineId);
		}, machineConfig.delayMs);
	}

	onDestroy(async () => {
		clearInterval(updateInterval);

		// Clean up the machine when component is destroyed
		try {
			await assemblySystem.removeMachine(machineId);
		} catch (error) {}

		// Unregister the highlighter
		assemblySystem.unregisterHighlighter(machineId);

		messageContext?.destroy();
	});

	async function reloadProgram(shouldStep: boolean) {
		logs = [];

		try {
			messageContext.clearTimers();

			if (!(await assemblySystem.machineExists(machineId))) {
				await assemblySystem.createMachineWithId(machineId);
			}

			await assemblySystem.loadProgram(machineId, data.code);

			if (shouldStep) {
				await assemblySystem.stepMachine(machineId, machineConfig.stepBy);
			}

			await syncMachineState();

			// Refresh memory display after execution
			memoryActions.refreshMemory(machineId);
			errorMessage = null;
		} catch (error) {
			displayError(error);
		}
	}

	function displayError(error: unknown) {
		if (error instanceof Error) {
			errorMessage = error.message;
		} else if (typeof error === 'string') {
			errorMessage = error;
		} else if (typeof error === 'object' && error !== null) {
			errorMessage = JSON.stringify(error, null, 2);
		}
	}

	async function syncMachineState() {
		try {
			const previousPc = machineState?.registers.pc;
			machineState = await assemblySystem.inspectMachine(machineId);

			// Trigger line highlighting if program counter changed
			if (machineState && machineState.registers.pc !== previousPc) {
				// Use AssemblySystem to properly map PC to source line
				assemblySystem.highlightLineFromPC(machineId, machineState.registers.pc);
			}

			const effects = await assemblySystem.consumeMachineEffects(machineId);

			const printEffects = effects
				.filter((effect) => effect.type === 'Print')
				.map((effect) => effect.text);

			if (printEffects.length > 0) {
				logs = [...logs, ...printEffects].slice(-10);
			}

			const combinedSleepMs = effects
				.filter((effect) => effect.type === 'Sleep')
				.map((effect) => effect.ms)
				.reduce((a, b) => a + b, 0);

			// Wake the machine after the combined sleep duration.
			if (combinedSleepMs > 0) {
				setTimeout(() => {
					assemblySystem.send('wakeMachine', { machineId });
				}, combinedSleepMs);
			}

			const messages = await assemblySystem.consumeMessages(machineId);

			messages.forEach((message: Message) => {
				if (message.action.type === 'Data') {
					const payload =
						message.action.body.length === 1 ? message.action.body[0] : message.action.body;

					messageContext.send(payload, { to: message.sender.port });
				}
			});

			if (machineState?.status === 'Halted') {
				await updateMachineConfig({ isRunning: false });
			}
		} catch (error) {
			// Silently handle state update errors to avoid spam
		}
	}

	function measureContainerWidth() {
		const gap = 8;

		if (mainContainer) {
			previewContainerWidth = mainContainer.clientWidth + gap;
		}
	}

	function onHighlightLineSetup(callback: (lineNo: number) => void) {
		highlightLineCallback = callback;

		// Register this highlighter with the AssemblySystem
		assemblySystem.registerHighlighter(machineId, callback);
	}
</script>

<div class="group relative flex gap-2">
	<div class="group relative flex flex-col gap-2" bind:this={mainContainer}>
		<!-- Floating Action Button -->
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between gap-1">
			<div class="z-10 rounded-lg bg-zinc-900/60 px-2 py-1 backdrop-blur-lg">
				<div class="font-mono text-xs font-medium text-zinc-400">asm</div>
			</div>

			<div class="flex">
				<button
					onclick={() => (showSettings = !showSettings)}
					class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
					title="Machine settings"
				>
					<Icon icon="lucide:settings" class="h-4 w-4 text-zinc-300" />
				</button>

				<button
					onclick={toggleMemoryViewer}
					class="group-hover:not-disabled:opacity-100 rounded p-1 transition-opacity hover:bg-zinc-700 disabled:cursor-not-allowed group-hover:disabled:opacity-30 sm:opacity-0"
					title="Toggle memory viewer"
					disabled={machineState === null}
				>
					<Icon icon="lucide:binary" class="h-4 w-4 text-zinc-300" />
				</button>

				<button
					onclick={resetMachine}
					class="group-hover:not-disabled:opacity-100 rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 group-hover:disabled:opacity-30 sm:opacity-0"
					title="Reset machine"
					disabled={machineState === null}
				>
					<Icon icon="lucide:refresh-ccw" class="h-4 w-4 text-zinc-300" />
				</button>

				<button
					onclick={stepMachine}
					class="group rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
					title={`Step ${machineConfig.stepBy} cycle${machineConfig.stepBy > 1 ? 's' : ''}`}
				>
					<Icon
						icon="lucide:step-forward"
						class="h-4 w-4 text-zinc-300 group-focus:text-green-300"
					/>
				</button>

				<button
					onclick={togglePlayPause}
					class="group rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
					title={machineConfig.isRunning ? 'Pause machine' : 'Run machine'}
				>
					<Icon
						icon={machineConfig.isRunning ? 'lucide:pause' : 'lucide:play'}
						class="h-4 w-4 text-zinc-300 group-focus:text-green-300"
					/>
				</button>
			</div>
		</div>

		<div
			class="flex min-w-80 flex-col rounded-lg border bg-zinc-900/95 px-3 py-3 font-mono text-gray-50 hover:border-zinc-400"
			class:border-red-400={errorMessage}
			class:border-purple-400={machineState?.status === 'Awaiting'}
			class:border-gray-600={machineState?.status === 'Halted'}
			class:border-orange-400={machineState && machineState.inbox_size > 50}
			class:border-red-600={machineState && machineState.inbox_size > 50}
			class:border-blue-400={machineState && machineState.outbox_size >= 1}
			class:border-gray-500={machineState?.status === 'Sleeping'}
			class:!border-zinc-300={selected}
			class:nodrag={!dragEnabled}
		>
			<!-- Top handles (inputs) -->
			{#each Array.from({ length: inletCount }) as _, index}
				<StandardHandle
					port="inlet"
					id={index}
					title={`Inlet ${index}`}
					total={inletCount}
					{index}
				/>
			{/each}

			<div class="flex flex-col gap-2">
				<!-- Editor -->
				<div class="nodrag">
					<AssemblyEditor
						value={data.code}
						onchange={(newCode) => {
							updateNodeData(nodeId, { code: newCode });
						}}
						onrun={playMachine}
						placeholder="Enter assembly code..."
						highlightLine={onHighlightLineSetup}
					/>
				</div>

				<!-- Machine State Viewer -->
				<MachineStateViewer {machineId} state={machineState} error={errorMessage} {logs} />

				<!-- Memory Viewer -->
				{#if machineState && data.showMemoryViewer}
					<PaginatedMemoryViewer {machineId} />
				{/if}
			</div>

			<!-- Bottom handles (outputs) -->
			{#each Array.from({ length: outletCount }) as _, index}
				<StandardHandle
					type="message"
					port="outlet"
					id={index}
					title={`Outlet ${index}`}
					total={outletCount}
					{index}
				/>
			{/each}
		</div>
	</div>

	{#if showSettings}
		<div class="absolute" style="left: {previewContainerWidth}px;">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			{@render settings()}
		</div>
	{/if}
</div>

{#snippet settings()}
	<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
		<div class="space-y-4">
			<div>
				<label class="mb-2 block text-xs font-medium text-zinc-300">Delay (ms)</label>
				<input
					type="number"
					min="10"
					max="5000"
					step="10"
					value={machineConfig.delayMs}
					onchange={(e) => {
						const newDelay = parseInt((e.target as HTMLInputElement).value);

						if (!isNaN(newDelay) && newDelay >= 10 && newDelay <= 5000) {
							updateMachineConfig({ delayMs: newDelay });

							setTimeout(() => setupPolling(), 5);
						}
					}}
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
				/>
				<div class="mt-1 text-xs text-zinc-500">Clock speed for automatic execution</div>
			</div>

			<div>
				<label class="mb-2 block text-xs font-medium text-zinc-300">Step By</label>
				<input
					type="number"
					min="1"
					max="1000"
					value={machineConfig.stepBy}
					onchange={(e) => {
						const newStepBy = parseInt((e.target as HTMLInputElement).value);

						if (!isNaN(newStepBy) && newStepBy >= 1 && newStepBy <= 1000) {
							updateMachineConfig({ stepBy: newStepBy });
						}
					}}
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
				/>
				<div class="mt-1 text-xs text-zinc-500">Cycles to execute per step</div>
			</div>
		</div>
	</div>
{/snippet}
