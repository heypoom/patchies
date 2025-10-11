<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { match, P } from 'ts-pattern';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { MIDISystem, type MIDIOutputConfig } from '$lib/canvas/MIDISystem';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { midiOutputDevices } from '../../../stores/midi.store';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: MIDIOutputConfig;
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();
	const midiSystem = MIDISystem.getInstance();

	let messageContext: MessageContext;
	let showSettings = $state(false);
	let errorMessage = $state<string | null>(null);
	let lastSentTime = $state<number>(0);

	const deviceId = $derived(data.deviceId || '');
	const channel = $derived(data.channel || 1);
	const event = $derived(data.event || 'noteOn');

	const borderColor = $derived.by(() => {
		const now = Date.now();
		if (errorMessage) return 'border-red-500';
		if (now - lastSentTime < 200) return 'border-blue-500';
		if (selected) return 'border-zinc-400';

		return 'border-zinc-600';
	});

	const statusIcon = $derived.by(() => {
		const now = Date.now();
		if (errorMessage) return 'lucide:alert-circle';
		if (now - lastSentTime < 200) return 'lucide:zap';

		return 'lucide:volume-2';
	});

	const dataFieldType = $derived.by(() => {
		return match(event)
			.with('noteOn', 'noteOff', () => 'note')
			.with('controlChange', () => 'control')
			.with('programChange', () => 'program')
			.otherwise(() => 'none');
	});

	type MidiOutMessage =
		| { type: 'bang' }
		| ({ type: 'send' } & MIDIOutputConfig)
		| ({ type: 'set' } & MIDIOutputConfig)
		| ({ type: MIDIOutputConfig['event'] } & Exclude<MIDIOutputConfig, 'event'>);

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with({ type: 'bang' }, () => {
					sendMidiMessage();
				})
				.with({ type: 'set' }, (md) => {
					updateNodeData(nodeId, { ...md });
				})
				.with({ type: 'send', deviceId: P.string, channel: P.number, event: P.string }, (md) => {
					const config = {
						...data,
						...md,
						deviceId: md.deviceId ?? data.deviceId,
						channel: md.channel ?? data.channel,
						event: md.event ?? data.event
					};

					sendMidiMessage(config as MIDIOutputConfig);
				})
				.with(
					{
						type: P.union('noteOn', 'noteOff', 'controlChange', 'programChange'),
						deviceId: P.string,
						channel: P.number,
						event: P.string
					},
					(md) => {
						const config = {
							...data,
							...md,
							deviceId: md.deviceId ?? data.deviceId,
							channel: md.channel ?? data.channel,
							event: md.event ?? data.event
						};

						sendMidiMessage(config as MIDIOutputConfig);
					}
				);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	};

	async function sendMidiMessage(userConfig?: MIDIOutputConfig) {
		const config = { ...data, ...userConfig };

		if (!config.deviceId) {
			errorMessage = 'No MIDI device selected';
			showSettings = true;
			return;
		}

		if (!midiSystem.isInitialized) {
			try {
				await midiSystem.initialize();
			} catch (error) {
				errorMessage = 'Failed to initialize MIDI system';
				return;
			}
		}

		try {
			midiSystem.sendMidiMessage(config);
			lastSentTime = Date.now();
			errorMessage = null;
		} catch (error) {
			errorMessage = 'Failed to send MIDI message';
		}
	}

	function getDefaultDataForMessageType(msgType: string) {
		return match(msgType)
			.with(P.union('noteOn', 'noteOff'), () => ({ note: 60, velocity: 127 }))
			.with('controlChange', () => ({ control: 1, value: 64 }))
			.with('programChange', () => ({ program: 1 }))
			.otherwise(() => ({}));
	}

	function updateMessageType(newMessageType: string) {
		const defaultData = getDefaultDataForMessageType(newMessageType);
		updateNodeData(nodeId, {
			event: newMessageType,
			...defaultData
		});
	}

	onMount(async () => {
		messageContext = new MessageContext(nodeId);
		messageContext.queue.addCallback(handleMessage);

		// Initialize MIDI system to populate device lists
		try {
			await midiSystem.initialize();
		} catch (error) {
			console.warn('Failed to initialize MIDI on mount:', error);
		}
	});

	onDestroy(() => {
		messageContext.queue.removeCallback(handleMessage);
		messageContext.destroy();
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-100">midi.out</div>
				</div>

				<button
					class="rounded p-1 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 sm:opacity-0"
					onclick={() => (showSettings = !showSettings)}
					title="Settings"
				>
					<Icon icon="lucide:settings" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} />

				{#if !deviceId}
					<button
						class={[
							'flex w-full min-w-[120px] flex-col items-center justify-center rounded-md border bg-zinc-900 p-3 text-zinc-300 hover:bg-zinc-800',
							'border-amber-500',
							selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
						]}
						onclick={() => (showSettings = true)}
						title="Select MIDI device"
					>
						<Icon icon="lucide:settings" class="mb-2 h-5 w-5" />
						<div class="text-xs">
							<span class="text-amber-400">Select device</span>
						</div>
						<div class="mt-1 text-[10px] text-zinc-500">Configure first</div>
					</button>
				{:else}
					<button
						class={[
							'flex w-full min-w-[120px] flex-col items-center justify-center rounded-md border bg-zinc-900 p-3 text-zinc-300 hover:bg-zinc-800',
							borderColor,
							selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
						]}
						onclick={() => sendMidiMessage()}
						title="Send MIDI message"
					>
						<Icon icon={statusIcon} class="mb-2 h-5 w-5" />
						<div class="text-xs">
							{#if errorMessage}
								<span class="text-red-400">Error</span>
							{:else}
								<span class="text-zinc-400">{event}</span>
							{/if}
						</div>
						<div class="mt-1 max-w-[100px] truncate text-[10px] text-zinc-500">
							{midiSystem.getOutputById(deviceId)?.name || 'Unknown'}
						</div>
					</button>
				{/if}
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
						<label class="mb-2 block text-xs font-medium text-zinc-300">MIDI Device</label>
						<select
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
							value={deviceId}
							onchange={(e) =>
								updateNodeData(nodeId, {
									deviceId: (e.target as HTMLSelectElement).value
								})}
						>
							<option value="">Select device...</option>
							{#each $midiOutputDevices as device}
								<option value={device.id}>{device.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Channel</label>
						<select
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
							value={channel}
							onchange={(e) =>
								updateNodeData(nodeId, {
									channel: parseInt((e.target as HTMLSelectElement).value)
								})}
						>
							{#each Array(16) as _, i}
								<option value={i + 1}>Channel {i + 1}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Message Type</label>
						<select
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
							value={event}
							onchange={(e) => updateMessageType((e.target as HTMLSelectElement).value)}
						>
							<option value="noteOn">Note On</option>
							<option value="noteOff">Note Off</option>
							<option value="controlChange">Control Change</option>
							<option value="programChange">Program Change</option>
						</select>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Data</label>
						{#if dataFieldType === 'note'}
							<div class="grid grid-cols-2 gap-2">
								<div>
									<label class="mb-1 block text-[10px] text-zinc-400">Note</label>
									<input
										type="number"
										min="0"
										max="127"
										class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
										value={data.note || 60}
										onchange={(e) =>
											updateNodeData(nodeId, {
												note: parseInt((e.target as HTMLInputElement).value)
											})}
									/>
								</div>
								<div>
									<label class="mb-1 block text-[10px] text-zinc-400">Velocity</label>
									<input
										type="number"
										min="0"
										max="127"
										class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
										value={data.velocity || 127}
										onchange={(e) =>
											updateNodeData(nodeId, {
												velocity: parseInt((e.target as HTMLInputElement).value)
											})}
									/>
								</div>
							</div>
						{:else if dataFieldType === 'control'}
							<div class="grid grid-cols-2 gap-2">
								<div>
									<label class="mb-1 block text-[10px] text-zinc-400">Control</label>
									<input
										type="number"
										min="0"
										max="127"
										class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
										value={data.control || 1}
										onchange={(e) =>
											updateNodeData(nodeId, {
												control: parseInt((e.target as HTMLInputElement).value)
											})}
									/>
								</div>
								<div>
									<label class="mb-1 block text-[10px] text-zinc-400">Value</label>
									<input
										type="number"
										min="0"
										max="127"
										class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
										value={data.value || 64}
										onchange={(e) =>
											updateNodeData(nodeId, {
												value: parseInt((e.target as HTMLInputElement).value)
											})}
									/>
								</div>
							</div>
						{:else if dataFieldType === 'program'}
							<div>
								<label class="mb-1 block text-[10px] text-zinc-400">Program</label>
								<input
									type="number"
									min="0"
									max="127"
									class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
									value={data.program || 1}
									onchange={(e) =>
										updateNodeData(nodeId, {
											program: parseInt((e.target as HTMLInputElement).value)
										})}
								/>
							</div>
						{/if}
					</div>

					{#if errorMessage}
						<div class="rounded border border-red-700 bg-red-900/20 p-2">
							<p class="text-xs text-red-400">{errorMessage}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
