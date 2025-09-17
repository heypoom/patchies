<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AssemblySystem } from '$lib/assembly/AssemblySystem';
	import { regionPalettes, getRegionClassName } from '$lib/assembly/regionColors';
	import { memoryRegionStore } from '$lib/assembly/memoryRegionStore';
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
			color?: number;
		};
		selected?: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let assemblySystem = AssemblySystem.getInstance();
	let messageContext: MessageContext;
	let values = $state<number[]>([]);
	let errorMessage = $state<string | null>(null);
	let showSettings = $state(false);

	// Configuration with defaults
	const machineId = $derived(data.machineId ?? 0);
	const address = $derived(data.address ?? 0);
	const size = $derived(data.size ?? 8); // Number of bytes to display
	const format = $derived(data.format ?? 'hex');
	const signed = $derived(data.signed ?? false);
	const color = $derived(data.color ?? Math.floor(Math.random() * regionPalettes.length));

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
				if (values.length > 0) {
					messageContext.send(values);
				}
			});
	};

	function updateConfig(updates: Partial<typeof data>) {
		updateNodeData(nodeId, { ...data, ...updates });

		setTimeout(updateValue, 10);
	}

	async function updateValue() {
		try {
			if (!(await assemblySystem.machineExists(machineId))) {
				values = [];
				errorMessage = `Machine ${machineId} does not exist`;
				return;
			}

			const memoryData = await assemblySystem.readMemory(machineId, address, size);
			if (!memoryData || memoryData.length === 0) {
				values = [];
				errorMessage = `Cannot read memory at address ${address}`;
				return;
			}

			values = memoryData;
			errorMessage = null;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			values = [];
		}
	}

	function formatValue(val: number): string {
		return match(format)
			.with('hex', () => val.toString(16).toUpperCase().padStart(2, '0'))
			.with('binary', () => val.toString(2).padStart(8, '0'))
			.with('decimal', () => val.toString().padStart(3, '0'))
			.exhaustive();
	}

	async function setMemoryWithColor(useColor?: number) {
		try {
			if (!(await assemblySystem.machineExists(machineId))) {
				errorMessage = `Machine ${machineId} does not exist`;
				return;
			}

			// Set memory value with specified color or current color
			const colorToUse = useColor !== undefined ? useColor : color;
			await assemblySystem.setMemoryValue(machineId, address, values, colorToUse);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	const columns = $derived(Math.min(values.length, 8));

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

		// Clean up memory regions when this viewer is destroyed
		if (values.length > 0) {
			// Find and remove the memory region for this address/size combination
			const existingRegions = assemblySystem.getMemoryRegions(machineId);
			const regionToRemove = existingRegions.find((r) => r.offset === address && r.size === size);

			if (regionToRemove) {
				memoryRegionStore.removeRegion(machineId, regionToRemove.id);
			}
		}
	});

	// Auto-refresh when configuration changes
	$effect(() => {
		// React to changes in machineId, address, or size
		if (machineId !== undefined && address !== undefined && size !== undefined) {
			updateValue();
		}
	});

	// Auto-update memory region when color changes
	$effect(() => {
		// When color changes, update any existing memory region
		if (values.length > 0) {
			setMemoryWithColor();
		}
	});

	const palette = $derived(getRegionClassName(color));
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<!-- Floating header -->
		<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
			<div></div>

			<button
				class="z-4 rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
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

				<div
					class={[
						'relative flex min-w-[120px] flex-col gap-1 rounded-lg border bg-zinc-900 px-2 py-2 font-mono',
						selected
							? palette.viewer?.split(' ')[0] || 'border-zinc-400'
							: 'border-zinc-800 hover:border-zinc-700',
						errorMessage ? 'border-red-500' : ''
					]}
				>
					{#if errorMessage}
						<div class="px-2 text-xs text-red-400">
							❌ {errorMessage}
						</div>
					{:else if values.length > 0}
						<!-- Values grid -->
						<div
							class="grid gap-x-2 font-mono text-xs"
							style="grid-template-columns: repeat({columns}, minmax(0, 1fr));"
						>
							{#each values as val, i}
								{@const palette = getRegionClassName(color)}
								<div
									class={[
										'px-1 text-center',
										val === 0 ? 'text-zinc-600' : palette.viewer?.split(' ')[1] || 'text-green-400'
									]}
								>
									{formatValue(val)}
								</div>
							{/each}
						</div>
					{:else}
						<div class="px-2 text-center text-xs text-zinc-500">No data</div>
					{/if}

					<!-- Floating address label -->
					{#if values.length > 0}
						<div
							class="absolute bottom-[-16px] left-0 min-w-[100px] font-mono text-[8px] text-zinc-500"
						>
							M{machineId}:0x{address.toString(16).padStart(4, '0')} s={size}
						</div>
					{/if}
				</div>

				<!-- Outlet -->
				<StandardHandle port="outlet" type="message" total={1} index={0} title="Current value" />
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
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-100"
				/>
			</div>

			<div>
				<label class="mb-2 block text-xs font-medium text-zinc-300">Size (bytes to display)</label>
				<input
					type="number"
					min="1"
					max="32"
					value={size}
					onchange={(e) => {
						const newSize = parseInt((e.target as HTMLInputElement).value);
						if (!isNaN(newSize) && newSize >= 1 && newSize <= 32) {
							updateConfig({ size: newSize });
						}
					}}
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
				/>
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

			<div>
				<label class="mb-2 block text-xs font-medium text-zinc-300">Memory Color</label>
				<div class="flex flex-wrap gap-1">
					{#each regionPalettes as palette, i}
						<button
							onclick={() => updateConfig({ color: i })}
							class={[
								'h-4 w-4 rounded border transition-all',
								color === i ? 'border-2 border-white' : 'border-zinc-600 hover:border-zinc-400',
								palette.bg
							]}
							title={palette.name}
						></button>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/snippet}
