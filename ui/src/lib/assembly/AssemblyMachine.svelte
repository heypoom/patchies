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
	import { Port } from 'machine';
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
		};
		selected?: boolean;
	} = $props();

	let assemblySystem = AssemblySystem.getInstance();
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let machineState = $state<InspectedMachine | null>(null);
	let logs = $state<string[]>([]);
	let dragEnabled = $state(true);
	let machineConfig = $state<MachineConfig>({ isRunning: false, delayMs: 100, stepBy: 1 });
	let showSettings = $state(false);
	let mainContainer: HTMLDivElement;

	const { updateNodeData } = useSvelteFlow();

	let inletCount = $derived(data.inletCount ?? 3);
	let outletCount = $derived(data.outletCount ?? 3);

	let previewContainerWidth = $state(0);
	let updateInterval: NodeJS.Timeout | number;

	// Machine ID is derived from node ID
	const machineId = parseInt(nodeId.replace(/\D/g, '')) || 0;

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { code: newCode });

		setTimeout(() => reloadProgram());
	};

	const toggleMemoryViewer = () =>
		updateNodeData(nodeId, { showMemoryViewer: !data.showMemoryViewer });

	const handleMessage: MessageCallbackFn = async (message, meta) => {
		try {
			await match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, () => {
					reloadProgram();
				})
				.with({ type: 'bang' }, handleBangSignal)
				.with({ type: 'send', data: P.any }, async ({ data }) => {
					// Send message to the assembly machine
					await assemblySystem.sendMessage(machineId, {
						sender: new Port(Number(meta.source) || 0, 0),
						action: {
							type: 'Data',
							body: Array.isArray(data) ? data : [Number(data) || 0]
						},
						recipient: undefined
					});
				})
				.otherwise(() => {
					// Handle other message types
				});
		} catch (error) {
			displayError(error);
		}
	};

	// When a 'bang' message is received, load and step the machine.
	async function handleBangSignal() {
		try {
			if (!(await assemblySystem.machineExists(machineId))) {
				await assemblySystem.createMachineWithId(machineId);
			}

			const state = await assemblySystem.inspectMachine(machineId);

			if (!state || state.status === 'Halted') {
				await assemblySystem.loadProgram(machineId, data.code);
			} else {
				await assemblySystem.stepMachine(machineId, machineConfig.stepBy);
			}

			await syncMachineState();

			memoryActions.refreshMemory(machineId);
			errorMessage = null;
		} catch (error) {
			displayError(error);
		}
	}

	async function resetMachine() {
		try {
			await assemblySystem.resetMachine(machineId);
			await syncMachineState();

			memoryActions.refreshMemory(machineId);
			errorMessage = null;
		} catch (error) {
			displayError(error);
		}
	}

	async function stepMachine() {
		try {
			if (!(await assemblySystem.machineExists(machineId))) {
				await assemblySystem.createMachineWithId(machineId);
			}

			await assemblySystem.stepMachine(machineId, machineConfig.stepBy);

			await syncMachineState();

			memoryActions.refreshMemory(machineId);
			errorMessage = null;
		} catch (error) {
			displayError(error);
		}
	}

	async function togglePlayPause() {
		try {
			if (machineConfig.isRunning) {
				await assemblySystem.pauseMachine(machineId);
				machineConfig = { ...machineConfig, isRunning: false };
			} else {
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
				machineConfig = { ...machineConfig, isRunning: true };
			}

			// Double-check with the actual config
			const latestConfig = await assemblySystem.getMachineConfig(machineId);
			machineConfig = latestConfig;
		} catch (error) {
			displayError(error);
		}
	}

	function updateConfig(updates: Partial<MachineConfig>) {
		assemblySystem.setMachineConfig(machineId, updates);
		machineConfig = { ...machineConfig, ...updates };
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		reloadProgram();
		measureContainerWidth();

		// Load machine config async
		(async () => {
			try {
				machineConfig = await assemblySystem.getMachineConfig(machineId);
			} catch (error) {
				// Use default config if unable to load
			}
		})();

		updateInterval = setInterval(async () => {
			await syncMachineState();

			// Also sync machine config to keep isRunning state updated
			try {
				const latestConfig = await assemblySystem.getMachineConfig(machineId);

				if (latestConfig.isRunning !== machineConfig.isRunning) {
					machineConfig = latestConfig;
				}

				// Refresh memory when machine is running
				if (machineConfig.isRunning) {
					memoryActions.refreshMemory(machineId);
				}
			} catch (error) {
				// Ignore config sync errors
			}
		}, 100);
	});

	onDestroy(async () => {
		clearInterval(updateInterval);

		// Clean up the machine when component is destroyed
		try {
			await assemblySystem.removeMachine(machineId);
		} catch (error) {}

		messageContext?.destroy();
	});

	async function reloadProgram() {
		try {
			messageContext.clearTimers();

			if (!(await assemblySystem.machineExists(machineId))) {
				await assemblySystem.createMachineWithId(machineId);
			}

			await assemblySystem.loadProgram(machineId, data.code);
			await assemblySystem.stepMachine(machineId, machineConfig.stepBy);

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
			machineState = await assemblySystem.inspectMachine(machineId);

			// Get effects/logs
			const effects = await assemblySystem.consumeMachineEffects(machineId);

			logs = effects
				.filter((effect: Effect) => effect.type === 'Print')
				.map((effect: Effect) => (effect.type === 'Print' ? effect.text : ''));

			const messages = await assemblySystem.consumeMessages();

			messages.forEach((message: Message) => {
				messageContext.send(message.action, { to: 0 });
			});
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
					disabled={machineState === null || machineState.status === 'Ready'}
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
						onrun={reloadProgram}
						placeholder="Enter assembly code..."
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
							updateConfig({ delayMs: newDelay });
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
							updateConfig({ stepBy: newStepBy });
						}
					}}
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
				/>
				<div class="mt-1 text-xs text-zinc-500">Cycles to execute per step</div>
			</div>
		</div>
	</div>
{/snippet}
