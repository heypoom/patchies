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
			address?: number;
			size?: number;
			format?: 'hex' | 'decimal' | 'binary';
			signed?: boolean;
		};
		selected?: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let assemblySystem = AssemblySystem.getInstance();
	let messageContext: MessageContext;
	let value = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);
	let showSettings = $state(false);

	// Configuration with defaults
	const machineId = $derived(data.machineId ?? 0);
	const address = $derived(data.address ?? 0);
	const size = $derived(data.size ?? 1); // 1, 2, 4, 8 bytes
	const format = $derived(data.format ?? 'hex');
	const signed = $derived(data.signed ?? false);

	const handleMessage: MessageCallbackFn = (message, meta) => {
		match(message)
			.with({ type: 'set', address: P.number }, ({ address: newAddress }) => {
				updateConfig({ address: newAddress });
			})
			.with({ type: 'set', machineId: P.number }, ({ machineId: newMachineId }) => {
				updateConfig({ machineId: newMachineId });
			})
			.with({ type: 'refresh' }, () => {
				updateValue();
			})
			.with({ type: 'bang' }, () => {
				updateValue();
				if (value !== null) {
					messageContext.send(value);
				}
			});
	};

	function updateConfig(updates: Partial<typeof data>) {
		updateNodeData(nodeId, { ...data, ...updates });
		// Update value after config change
		setTimeout(updateValue, 10);
	}

	function updateValue() {
		try {
			if (!assemblySystem.machineExists(machineId)) {
				value = null;
				errorMessage = `Machine ${machineId} does not exist`;
				return;
			}

			const memoryData = assemblySystem.readMemory(machineId, address, size);
			if (!memoryData || memoryData.length === 0) {
				value = null;
				errorMessage = `Cannot read memory at address ${address}`;
				return;
			}

			// Convert bytes to value based on size and signedness
			let rawValue = 0;
			for (let i = 0; i < size && i < memoryData.length; i++) {
				rawValue |= (memoryData[i] << (i * 8));
			}

			// Handle signed values
			if (signed && size < 8) {
				const signBit = 1 << (size * 8 - 1);
				if (rawValue & signBit) {
					rawValue -= (1 << (size * 8));
				}
			}

			value = rawValue;
			errorMessage = null;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			value = null;
		}
	}

	function formatValue(val: number): string {
		return match(format)
			.with('hex', () => `0x${val.toString(16).toUpperCase().padStart(size * 2, '0')}`)
			.with('binary', () => `0b${val.toString(2).padStart(size * 8, '0')}`)
			.with('decimal', () => val.toString())
			.exhaustive();
	}

	onMount(() => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Initial value update
		updateValue();

		// Periodic refresh
		const refreshInterval = setInterval(updateValue, 200);

		return () => {
			clearInterval(refreshInterval);
		};
	});

	onDestroy(() => {
		messageContext?.destroy();
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<!-- Floating header -->
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div class="text-xs text-zinc-400 opacity-0 group-hover:opacity-100">
				asm.value
			</div>

			<button
				class="z-4 rounded p-1 transition-opacity hover:bg-zinc-700 opacity-0 group-hover:opacity-100"
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
					title="Control messages"
					class={`!-top-2 ${selected ? '' : 'opacity-30 group-hover:opacity-100 sm:opacity-0'}`}
				/>

				<!-- Main display -->
				<div
					class={[
						'flex min-w-[120px] flex-col items-center justify-center gap-1 rounded-lg border-2 bg-zinc-900 px-3 py-2 font-mono',
						selected ? 'border-zinc-200' : 'border-zinc-700',
						errorMessage ? 'border-red-500' : '',
						'hover:border-zinc-400'
					]}
				>
					{#if errorMessage}
						<div class="text-xs text-red-400">
							❌ {errorMessage}
						</div>
					{:else if value !== null}
						<div class="text-sm font-bold text-green-400">
							{formatValue(value)}
						</div>
						<div class="text-xs text-zinc-500">
							M{machineId}:{address.toString(16).padStart(4, '0')}
						</div>
					{:else}
						<div class="text-xs text-zinc-500">
							No data
						</div>
					{/if}
				</div>

				<!-- Outlet -->
				<StandardHandle
					port="outlet"
					type="message"
					total={1}
					index={0}
					title="Current value"
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

			{@render settings()}
		</div>
	{/if}
</div>

{#snippet settings()}
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
				<label class="mb-2 block text-xs font-medium text-zinc-300">Memory Address (hex)</label>
				<input
					type="text"
					value={address.toString(16)}
					onchange={(e) => {
						const hexValue = (e.target as HTMLInputElement).value;
						const newAddress = parseInt(hexValue, 16);
						if (!isNaN(newAddress)) {
							updateConfig({ address: newAddress });
						}
					}}
					placeholder="0000"
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 font-mono"
				/>
			</div>

			<div>
				<label class="mb-2 block text-xs font-medium text-zinc-300">Size (bytes)</label>
				<select
					value={size}
					onchange={(e) => {
						const newSize = parseInt((e.target as HTMLSelectElement).value);
						updateConfig({ size: newSize });
					}}
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
				>
					<option value={1}>1 byte</option>
					<option value={2}>2 bytes</option>
					<option value={4}>4 bytes</option>
					<option value={8}>8 bytes</option>
				</select>
			</div>

			<div>
				<label class="mb-2 block text-xs font-medium text-zinc-300">Display Format</label>
				<select
					value={format}
					onchange={(e) => {
						const newFormat = (e.target as HTMLSelectElement).value as 'hex' | 'decimal' | 'binary';
						updateConfig({ format: newFormat });
					}}
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
				>
					<option value="hex">Hexadecimal</option>
					<option value="decimal">Decimal</option>
					<option value="binary">Binary</option>
				</select>
			</div>

			<div class="flex items-center gap-x-2">
				<label class="text-xs font-medium text-zinc-300">Signed</label>
				<input
					type="checkbox"
					checked={signed}
					onchange={(e) => updateConfig({ signed: (e.target as HTMLInputElement).checked })}
					class="h-4 w-4"
				/>
			</div>

			<div class="pt-2">
				<button
					onclick={updateValue}
					class="w-full rounded bg-green-700 px-3 py-1 text-xs text-white hover:bg-green-600"
				>
					Refresh Value
				</button>
			</div>
		</div>
	</div>
{/snippet}