<script lang="ts">
	import { Binary, FileText, Hash, Settings, Trash, X } from '@lucide/svelte/icons';
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AssemblySystem } from '$lib/assembly/AssemblySystem';
	import type { Action } from 'machine';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			values?: number[];
			format?: 'hex' | 'decimal';
			rows?: number;
		};
		selected?: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let assemblySystem = AssemblySystem.getInstance();
	let messageContext: MessageContext;
	let isBatch = $state(false);
	let batchInput = $state('');
	let showSettings = $state(false);

	const values = $derived(data.values ?? []);
	const format = $derived(data.format ?? 'hex');
	const rows = $derived(data.rows ?? 6);

	const columns = 8;
	const gridLimit = 2000;
	const count = $derived(Math.max(columns * rows, values.length));
	const overGridLimit = $derived(count > gridLimit);
	const base = $derived(format === 'hex' ? 16 : 10);

	const handleMessage: MessageCallbackFn = async (message, meta) => {
		const isMatchSimpleMessage = match(message)
			.with({ type: 'bang' }, () => {
				messageContext.send(values, { to: 0 });

				return true;
			})
			.with({ type: 'reset' }, async () => {
				updateNodeData(nodeId, { values: [] });
				return true;
			})
			.with({ type: 'setRows', value: P.number }, async ({ value }) => {
				updateNodeData(nodeId, { rows: value });
				return true;
			})
			.otherwise(() => false);

		if (isMatchSimpleMessage) return;

		if (meta.source.startsWith('asm-')) {
			const machineId = parseInt(meta.source.replace('asm-', ''));
			if (isNaN(machineId)) return;

			await match(message)
				.with(P.union(P.array(P.number), P.number), async (v) => {
					const body = Array.isArray(v) ? v : [v];
					const nextValues = [...values, ...body];

					updateNodeData(nodeId, { ...data, values: nextValues });
				})
				.with({ type: 'override', data: P.array(P.number) }, async ({ data: newData }) => {
					updateNodeData(nodeId, { ...data, values: newData });
				})
				.with(
					{ type: 'write', address: P.number, data: P.array(P.number) },
					async ({ address, data: writeData }) => {
						const nextValues = [...values];
						// Ensure the array is large enough to accommodate the write
						const requiredLength = address + writeData.length;
						while (nextValues.length < requiredLength) {
							nextValues.push(0);
						}

						for (let i = 0; i < writeData.length; i++) {
							nextValues[address + i] = writeData[i];
						}

						updateNodeData(nodeId, { ...data, values: nextValues });
					}
				)
				.with({ type: 'read', address: P.number, count: P.number }, async ({ address, count }) => {
					const memorySlice = values.slice(address, address + count);

					await sendToAssembly({ type: 'Data', body: memorySlice }, machineId);
				})
				.otherwise(() => {});

			return;
		}
	};

	async function sendToAssembly(action: Action, machineId: number) {
		let source = parseInt(nodeId.replace('asm.mem-', ''));
		if (isNaN(source)) source = 0;

		try {
			if (await assemblySystem.machineExists(machineId)) {
				await assemblySystem.sendMessage(machineId, action, source, 0);
			}
		} catch (error) {
			console.error('Failed to send message to assembly system:', error);
		}
	}

	const updateConfig = (updates: Partial<typeof data>) =>
		updateNodeData(nodeId, { ...data, ...updates });

	function setMemoryValue(address: number, value: number) {
		if (value > 65535) return;

		const newValues = [...values];
		newValues[address] = value;

		updateNodeData(nodeId, { ...data, values: newValues });
	}

	function writeMemoryValue(value: number, index: number) {
		if (value === undefined || value === null) return;

		setMemoryValue(index, value);
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
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		syncBatchInput();
	});

	onDestroy(() => {
		messageContext?.destroy();
	});

	function syncBatchInput() {
		if (isBatch) {
			batchInput = values
				.filter((v) => v)
				.map((v) => v.toString(base))
				.join(' ');
		}
	}

	// Update batch input when format or values change
	$effect(() => {
		syncBatchInput();
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
					<svelte:component this={format === 'hex' ? Hash : Binary} class="h-4 w-4" />
				</button>

				<button
					onclick={() => (isBatch = !isBatch)}
					class={['rounded p-1 hover:bg-zinc-700', isBatch && 'text-green-400']}
					title="Toggle batch edit mode"
				>
					<FileText class="h-4 w-4" />
				</button>
			</div>

			<div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
				<button
					onclick={() => updateNodeData(nodeId, { ...data, values: [] })}
					class={['rounded p-1 text-red-400 hover:bg-zinc-700']}
					title="Clear memory (!)"
				>
					<Trash class="h-4 w-4" />
				</button>

				<button
					onclick={() => (showSettings = !showSettings)}
					class={['rounded p-1 hover:bg-zinc-700', showSettings && 'text-blue-400']}
					title="Settings"
				>
					<Settings class="h-4 w-4" />
				</button>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<div class="relative">
				<!-- Inlet -->
				<StandardHandle
					port="inlet"
					type="message"
					id={0}
					total={1}
					index={0}
					title="Message inlet"
				
				nodeId={nodeId}/>

				<div
					class={[
						'relative flex min-w-[200px] flex-col gap-2 rounded-lg border bg-zinc-900 px-3 py-3 font-mono',
						selected ? 'border-zinc-300' : 'border-zinc-800 hover:border-zinc-700'
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
										'w-8 bg-transparent text-center text-[10px] uppercase outline-1 outline-none',
										value === 0 && 'placeholder-zinc-600',
										value === undefined && 'placeholder-zinc-700',
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
							class="nodrag h-[100px] w-full resize-none bg-transparent font-mono text-xs text-green-400 outline-none"
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
						{values.length} bytes • {format}
					</div>
				</div>

				<!-- Outlet -->
				<StandardHandle
					port="outlet"
					type="message"
					id={0}
					total={1}
					index={0}
					title="Message outlet"
				
				nodeId={nodeId}/>
			</div>
		</div>
	</div>

	{#if showSettings}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<X class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="nodrag w-48 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
				<div class="space-y-3">
					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Rows</label>
						<input
							type="number"
							min="1"
							max="100"
							value={rows}
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
							onchange={(e) => {
								const value = parseInt((e.target as HTMLInputElement).value);

								if (!isNaN(value) && value > 0) {
									updateConfig({ rows: value });
								}
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
