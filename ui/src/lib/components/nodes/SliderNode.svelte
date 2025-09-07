<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';

	let node: {
		id: string;
		data: {
			min?: number;
			max?: number;
			defaultValue?: number;
			isFloat?: boolean;
			value?: number;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let showSettings = $state(false);
	let sliderElement: HTMLInputElement;

	// Configuration values with defaults
	const min = $derived(node.data.min ?? 0);
	const max = $derived(node.data.max ?? (node.data.isFloat ? 1 : 100));
	const defaultValue = $derived(node.data.defaultValue ?? min);
	const isFloat = $derived(node.data.isFloat ?? false);
	const currentValue = $derived(node.data.value ?? defaultValue);

	// For display formatting
	const displayValue = $derived(
		isFloat ? Number(currentValue).toFixed(2) : Math.round(currentValue).toString()
	);

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with(P.number, (value) => {
				const newValue = Math.min(Math.max(value, min), max);
				updateNodeData(node.id, { ...node.data, value: newValue });
				messageContext.send(newValue);

				if (sliderElement) sliderElement.value = newValue.toString();
			})
			.with(P.union('reset', { type: 'reset' }), () => {
				updateNodeData(node.id, { ...node.data, value: defaultValue });
				messageContext.send(defaultValue);

				if (sliderElement) sliderElement.value = defaultValue.toString();
			})
			.with({ type: 'bang' }, () => {
				messageContext.send(currentValue);
			});
	};

	function handleSliderChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const rawValue = parseFloat(target.value);

		// Apply proper precision based on mode
		const newValue = isFloat ? rawValue : Math.round(rawValue);

		if (newValue !== currentValue) {
			updateNodeData(node.id, { ...node.data, value: newValue });
			messageContext.send(newValue);
		}
	}

	function updateConfig(updates: Partial<typeof node.data>) {
		const newData = { ...node.data, ...updates };

		// Ensure value is within new bounds
		if ('min' in updates || 'max' in updates) {
			const newMin = updates.min ?? min;
			const newMax = updates.max ?? max;
			const clampedValue = Math.min(Math.max(currentValue, newMin), newMax);
			if (clampedValue !== currentValue) {
				newData.value = clampedValue;
			}
		}

		updateNodeData(node.id, newData);
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		// Initialize slider value
		if (sliderElement) {
			sliderElement.value = currentValue.toString();
		}
	});

	onDestroy(() => {
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<button
					class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
					onclick={() => (showSettings = !showSettings)}
					title="Settings"
				>
					<Icon icon="lucide:settings" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<StandardHandle 
					port="inlet" 
					type="message"
					total={1} 
					index={0}
					class="!-top-2"
				/>

				<div
					class="flex w-full min-w-[100px] max-w-[130px] flex-col items-center justify-center gap-1 py-1"
				>
					<div class="pb-2 font-mono text-sm text-zinc-100">
						{displayValue}
					</div>

					<input
						bind:this={sliderElement}
						type="range"
						{min}
						{max}
						step={isFloat ? 0.01 : 1}
						value={currentValue}
						oninput={handleSliderChange}
						style="background: linear-gradient(to right, #3b82f6 0%, #3b82f6 {((currentValue -
							min) /
							(max - min)) *
							100}%, #3f3f46 {((currentValue - min) / (max - min)) * 100}%, #3f3f46 100%)"
						class="nodrag h-1 w-full cursor-pointer appearance-none rounded-lg
							[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-lg [&::-moz-range-progress]:bg-blue-500
							[&::-moz-range-thumb:hover]:bg-zinc-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
							[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-zinc-300
							[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-lg
							[&::-moz-range-track]:border-none
							[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
							[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
							[&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-track]:h-1
							[&::-webkit-slider-track]:rounded-lg"
					/>

					<div class="flex w-full justify-between font-mono text-[10px] text-zinc-500">
						<span>{isFloat ? min.toFixed(2) : min}</span>
						<span>{isFloat ? max.toFixed(2) : max}</span>
					</div>
				</div>

				<StandardHandle 
					port="outlet" 
					type="message"
					total={1} 
					index={0}
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
						<label class="mb-2 block text-xs font-medium text-zinc-300">Mode</label>
						<div class="flex gap-2">
							<label class="flex items-center">
								<input
									type="radio"
									name="mode"
									value="int"
									checked={!isFloat}
									onchange={() => updateConfig({ isFloat: false })}
									class="mr-2 h-3 w-3"
								/>
								<span class="text-xs text-zinc-300">Integer</span>
							</label>
							<label class="flex items-center">
								<input
									type="radio"
									name="mode"
									value="float"
									checked={isFloat}
									onchange={() => updateConfig({ isFloat: true })}
									class="mr-2 h-3 w-3"
								/>
								<span class="text-xs text-zinc-300">Float</span>
							</label>
						</div>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Minimum</label>
						<input
							type="number"
							step={isFloat ? 0.01 : 1}
							value={min}
							onchange={(e) => {
								const newMin = parseFloat((e.target as HTMLInputElement).value);
								updateConfig({ min: newMin });
							}}
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
						/>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Maximum</label>
						<input
							type="number"
							step={isFloat ? 0.01 : 1}
							value={max}
							onchange={(e) => {
								const newMax = parseFloat((e.target as HTMLInputElement).value);
								updateConfig({ max: newMax });
							}}
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
						/>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Default Value</label>
						<input
							type="number"
							step={isFloat ? 0.01 : 1}
							value={defaultValue}
							{min}
							{max}
							onchange={(e) => {
								const newDefault = parseFloat((e.target as HTMLInputElement).value);
								updateConfig({ defaultValue: newDefault });
							}}
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
						/>
					</div>

					<div class="pt-2">
						<button
							onclick={() => {
								updateNodeData(node.id, { ...node.data, value: defaultValue });

								if (sliderElement) {
									sliderElement.value = defaultValue.toString();
								}

								messageContext.send(defaultValue);
							}}
							class="w-full rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
						>
							Reset to Default
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
