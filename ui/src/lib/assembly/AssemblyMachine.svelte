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
	import type { InspectedMachine, Effect, Message } from './AssemblySystem';
	import { Port } from 'machine';
	import { memoryActions } from './memoryStore';
	import Icon from '@iconify/svelte';

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
		};
		selected?: boolean;
	} = $props();

	let assemblySystem = AssemblySystem.getInstance();
	let messageContext: MessageContext;
	let errorMessage = $state<string | null>(null);
	let machineState = $state<InspectedMachine | null>(null);
	let logs = $state<string[]>([]);
	let dragEnabled = $state(true);

	const { updateNodeData } = useSvelteFlow();

	let inletCount = $derived(data.inletCount ?? 3);
	let outletCount = $derived(data.outletCount ?? 3);

	// Machine ID is derived from node ID
	const machineId = parseInt(nodeId.replace(/\D/g, '')) || 0;

	const setCodeAndUpdate = (newCode: string) => {
		updateNodeData(nodeId, { code: newCode });

		setTimeout(() => updateMachine());
	};

	const handleMessage: MessageCallbackFn = (message, meta) => {
		try {
			match(message)
				.with({ type: 'set', code: P.string }, ({ code }) => {
					setCodeAndUpdate(code);
				})
				.with({ type: 'run' }, () => {
					updateMachine();
				})
				.with({ type: 'send', data: P.any }, ({ data }) => {
					// Send message to the assembly machine
					assemblySystem.sendMessage(machineId, {
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
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		updateMachine();

		const updateInterval = setInterval(updateMachineState, 100);

		return () => {
			clearInterval(updateInterval);
		};
	});

	onDestroy(() => {
		// Clean up the machine when component is destroyed
		try {
			assemblySystem.removeMachine(machineId);
		} catch (error) {}

		messageContext?.destroy();
	});

	function updateMachine() {
		try {
			messageContext.clearTimers();

			// Ensure machine exists before loading program
			if (!assemblySystem.machineExists(machineId)) {
				assemblySystem.createMachineWithId(machineId);
			}

			assemblySystem.loadProgram(machineId, data.code);
			assemblySystem.step(100);

			console.log('>>> running');

			updateMachineState();
			// Refresh memory display after execution
			memoryActions.refreshMemory(machineId);
			errorMessage = null;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function updateMachineState() {
		try {
			machineState = assemblySystem.inspectMachine(machineId);

			// Get effects/logs
			const effects = assemblySystem.consumeMachineEffects(machineId);
			logs = effects
				.filter((effect: Effect) => effect.type === 'Print')
				.map((effect: Effect) => (effect.type === 'Print' ? effect.text : ''));

			const messages = assemblySystem.consumeMessages();

			messages.forEach((message: Message) => {
				messageContext.send(message.action, { to: 0 });
			});
		} catch (error) {
			// Silently handle state update errors to avoid spam
		}
	}
</script>

<div class="group relative">
	<!-- Floating Action Button -->
	<div class="absolute -top-7 right-0 flex gap-1">
		<button
			onclick={updateMachine}
			class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
			title="Run assembly code"
		>
			<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
		</button>
	</div>

	<div
		class="flex min-w-80 flex-col space-y-2 rounded-lg border bg-zinc-900 px-3 py-3 font-mono text-gray-50 hover:border-zinc-400"
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
		<StandardHandle port="inlet" id={index} title={`Inlet ${index}`} total={inletCount} {index} />
	{/each}

	<!-- Header -->
	<div class="mb-2">
		<h3 class="text-sm font-medium text-zinc-300">{data.title || 'asm'}</h3>
	</div>

	<!-- Editor -->
	<div class="nodrag min-h-24">
		<AssemblyEditor
			value={data.code}
			onchange={(newCode) => {
				updateNodeData(nodeId, { code: newCode });
			}}
			placeholder="Enter assembly code..."
		/>
	</div>

	<!-- Machine State Viewer -->
	<MachineStateViewer {machineId} state={machineState} error={errorMessage} {logs} />

	<!-- Bottom handles (outputs) -->
	{#each Array.from({ length: outletCount }) as _, index}
		<StandardHandle
			port="outlet"
			id={index}
			title={`Outlet ${index}`}
			total={outletCount}
			{index}
		/>
	{/each}
	</div>
</div>
