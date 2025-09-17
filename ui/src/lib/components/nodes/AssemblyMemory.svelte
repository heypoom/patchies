<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AssemblySystem } from '$lib/assembly/AssemblySystem';
	import Icon from '@iconify/svelte';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			machineId?: number;
			values?: number[];
			autoReset?: boolean;
			format?: 'hex' | 'decimal';
		};
		selected?: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let assemblySystem = AssemblySystem.getInstance();
	let messageContext: MessageContext;
	let showSettings = $state(false);
	let isBatch = $state(false);
	let batchInput = $state('');

	// Configuration with defaults
	const machineId = $derived(data.machineId ?? 0);
	const values = $derived(data.values ?? []);
	const autoReset = $derived(data.autoReset ?? false);
	const format = $derived(data.format ?? 'hex');

	const columns = 8;
	const gridLimit = 1000;
	const count = $derived(Math.max(columns * 6, values.length));
	const overGridLimit = $derived(count > gridLimit);
	const base = $derived(format === 'hex' ? 16 : 10);

	const handleMessage: MessageCallbackFn = async (message, meta) => {
		await match(message)
			.with({ type: 'Data', body: P.array(P.number) }, async ({ body }) => {
				const newValues = [...values, ...body];
				updateNodeData(nodeId, { ...data, values: newValues });
				await sendToAssembly({ type: 'Data', body });
			})
			.with({ type: 'Override', data: P.array(P.number) }, async ({ data: newData }) => {
				updateNodeData(nodeId, { ...data, values: newData });
				await sendToAssembly({ type: 'Override', data: newData });
			})
			.with(
				{ type: 'Write', address: P.number, data: P.array(P.number) },
				async ({ address, data: writeData }) => {
					// Handle write to memory
					const newValues = [...values];
					for (let i = 0; i < writeData.length; i++) {
						if (address + i < newValues.length) {
							newValues[address + i] = writeData[i];
						}
					}
					updateNodeData(nodeId, { ...data, values: newValues });
					await sendToAssembly({ type: 'Write', address, data: writeData });
				}
			)
			.with({ type: 'Read', address: P.number, count: P.number }, async ({ address, count }) => {
				// Handle read from memory - send back data to requesting node
				const readData = values.slice(address, address + count);
				// Send read data back to sender
				if (meta?.inlet !== undefined) {
					messageContext.send({ type: 'Data', body: readData }, { to: 0 });
				}
				await sendToAssembly({ type: 'Read', address, count });
			})
			.with({ type: 'Reset' }, async () => {
				updateNodeData(nodeId, { ...data, values: [] });
				await sendToAssembly({ type: 'Reset' });
			})
			.with({ type: 'bang' }, () => {
				// Send current values as output
				messageContext.send({ type: 'Data', body: values }, { to: 0 });
			})
			.otherwise(() => {});
	};

	async function sendToAssembly(action: any) {
		try {
			if (await assemblySystem.machineExists(machineId)) {
				console.log(`send to assembly:`, { action, machineId });

				// Send message to assembly system
				// await assemblySystem.sendMessage(machineId, {
				// 	action,
				// 	sender: { block: parseInt(nodeId), port: 0 },
				// 	recipient: undefined
				// });
			}
		} catch (error) {
			console.error('Failed to send message to assembly system:', error);
		}
	}

	function updateConfig(updates: Partial<typeof data>) {
		updateNodeData(nodeId, { ...data, ...updates });
	}

	function setMemoryValue(address: number, value: number) {
		if (value > 65535) return;

		const newValues = [...values];
		newValues[address] = value;
		updateNodeData(nodeId, { ...data, values: newValues });
	}

	function writeMemoryValue(value: number, index: number) {
		if (value === undefined || value === null) return;

		// Update local state
		setMemoryValue(index, value);

		// Send write message to assembly system
		sendToAssembly({
			type: 'Write',
			address: index,
			data: [value]
		});
	}

	function toggleReset() {
		updateConfig({ autoReset: !autoReset });
	}

	function toggleFormat() {
		updateConfig({ format: format === 'hex' ? 'decimal' : 'hex' });
	}

	function updateBatch() {
		if (!isBatch) return;

		const newValues = batchInput
			.split(' ')
			.map((s) => parseInt(s, base))
			.filter((n) => !isNaN(n));

		if (newValues.length === 0) return;

		updateNodeData(nodeId, { ...data, values: newValues });
		sendToAssembly({ type: 'Override', data: newValues });
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Update batch input when switching to batch mode
		if (isBatch) {
			const dataStr = values.map((v) => v.toString(base)).join(' ');
			batchInput = dataStr;
		}
	});

	onDestroy(() => {
		messageContext?.destroy();
	});

	// Update batch input when format or values change
	$effect(() => {
		if (isBatch) {
			const dataStr = values.map((v) => v.toString(base)).join(' ');
			batchInput = dataStr;
		}
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<!-- Floating header -->
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
				<button
					onclick={toggleFormat}
					class="rounded p-1 hover:bg-zinc-700"
					title="Toggle format (hex/decimal)"
				>
					<span class="text-xs text-zinc-300">{format}</span>
				</button>

				<button
					onclick={() => (isBatch = !isBatch)}
					class={['rounded p-1 hover:bg-zinc-700', isBatch && 'text-green-400']}
					title="Toggle batch edit mode"
				>
					<Icon icon="lucide:file-text" class="h-4 w-4" />
				</button>

				<button
					onclick={toggleReset}
					class={['rounded p-1 hover:bg-zinc-700', autoReset && 'text-green-400']}
					title="Auto-reset on machine restart"
				>
					<Icon icon="lucide:refresh-cw" class="h-4 w-4" />
				</button>
			</div>

			<button
				class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
				onclick={() => (showSettings = !showSettings)}
				title="Settings"
			>
				<Icon icon="lucide:settings" class="h-4 w-4 text-zinc-300" />
			</button>
		</div>

		<div class="flex flex-col gap-2">
			<div class="relative">
				<!-- Inlet -->
				<StandardHandle
					port="inlet"
					type="message"
					total={1}
					index={0}
					title="Memory operations (Read/Write/Data)"
					class="top-0"
				/>

				<div
					class={[
						'relative flex min-w-[200px] flex-col gap-2 rounded-lg border bg-zinc-900 px-3 py-3 font-mono',
						selected ? 'border-green-400' : 'border-zinc-800 hover:border-zinc-700'
					]}
				>
					{#if overGridLimit && !isBatch}
						<p class="text-xs text-red-400">
							Values too large ({count} items)<br />Use text mode to edit.
						</p>
					{/if}

					{#if !isBatch && !overGridLimit}
						<div
							class="grid w-full items-center justify-center gap-y-[2px]"
							style="grid-template-columns: repeat({columns}, minmax(0, 1fr));"
						>
							{#each Array.from({ length: count }) as _, index}
								{@const value = values[index]}
								<input
									value={!value ? '' : value.toString(base).padStart(4, '0')}
									placeholder="0000"
									class={[
										'w-8 bg-transparent text-center text-[10px] uppercase outline-1 outline-gray-400',
										value === 0 && 'placeholder-gray-500',
										value === undefined && 'placeholder-gray-600',
										value > 0 && 'text-green-400'
									]}
									onchange={(e) => {
										const n = parseInt((e.target as HTMLInputElement).value, base);
										if (isNaN(n)) return setMemoryValue(index, 0);
										setMemoryValue(index, n);
									}}
									onblur={() => writeMemoryValue(value || 0, index)}
								/>
							{/each}
						</div>
					{/if}

					{#if isBatch}
						<textarea
							class="nodrag h-[100px] w-full resize-none bg-transparent font-mono text-xs text-green-400 outline-gray-400"
							value={batchInput}
							onchange={(e) => (batchInput = (e.target as HTMLTextAreaElement).value)}
							onblur={updateBatch}
							placeholder={`Enter ${format} values separated by spaces...`}
						></textarea>
					{/if}

					<!-- Machine info -->
					<div
						class="absolute bottom-[-16px] left-0 min-w-[100px] font-mono text-[8px] text-zinc-500"
					>
						M{machineId} • {values.length} bytes • {format}
						{#if autoReset}• auto-reset{/if}
					</div>
				</div>

				<!-- Outlet -->
				<StandardHandle
					port="outlet"
					type="message"
					total={1}
					index={0}
					title="Memory data output"
				/>
			</div>
		</div>
	</div>

	{#if showSettings}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
				<div class="space-y-4">
					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Machine ID</label>
						<input
							type="number"
							min="0"
							max="255"
							value={machineId}
							onchange={(e) => {
								const newMachineId = parseInt((e.target as HTMLInputElement).value);
								updateConfig({ machineId: newMachineId });
							}}
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
						/>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Display Format</label>
						<select
							value={format}
							onchange={(e) => {
								const newFormat = (e.target as HTMLSelectElement).value as 'hex' | 'decimal';
								updateConfig({ format: newFormat });
							}}
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
						>
							<option value="hex">Hexadecimal</option>
							<option value="decimal">Decimal</option>
						</select>
					</div>

					<div class="flex items-center gap-x-2">
						<label class="text-xs font-medium text-zinc-300">Auto-reset</label>
						<input
							type="checkbox"
							checked={autoReset}
							onchange={(e) => updateConfig({ autoReset: (e.target as HTMLInputElement).checked })}
							class="h-4 w-4"
						/>
						<span class="text-xs text-zinc-500">Clear on machine restart</span>
					</div>

					<div class="space-y-2">
						<label class="block text-xs font-medium text-zinc-300">Actions</label>
						<div class="flex gap-2">
							<button
								onclick={() => {
									updateNodeData(nodeId, { ...data, values: [] });
									sendToAssembly({ type: 'Reset' });
								}}
								class="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
							>
								Clear Memory
							</button>
							<button
								onclick={() => {
									// Fill with test pattern
									const testValues = Array.from({ length: 16 }, (_, i) => i + 1);
									updateNodeData(nodeId, { ...data, values: testValues });
									sendToAssembly({ type: 'Override', data: testValues });
								}}
								class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
							>
								Test Pattern
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
