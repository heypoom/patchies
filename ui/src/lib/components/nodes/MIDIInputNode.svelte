<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import { MIDISystem, type MIDIInputConfig } from '$lib/canvas/MIDISystem';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { midiInputDevices } from '../../../stores/midi.store';
	import { match, P } from 'ts-pattern';

	type EventType = 'noteOn' | 'noteOff' | 'controlChange' | 'programChange' | 'pitchBend';

	let {
		id: nodeId,
		data,
		selected
	}: {
		id: string;
		data: {
			deviceId?: string;
			channel?: number;
			events?: EventType[];
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();
	const midiSystem = MIDISystem.getInstance();

	let messageContext: MessageContext;
	let isListening = $state(false);
	let showSettings = $state(false);
	let errorMessage = $state<string | null>(null);

	const deviceId = $derived(data.deviceId || '');
	const channel = $derived(data.channel || 0);

	const events: EventType[] = $derived(
		data.events || ['noteOn', 'noteOff', 'controlChange', 'programChange', 'pitchBend']
	);

	const borderColor = $derived.by(() => {
		if (errorMessage) return 'border-red-500';
		if (isListening) return 'border-emerald-500';
		if (selected) return 'border-zinc-400';
		return 'border-zinc-600';
	});

	const statusIcon = $derived.by(() => {
		if (errorMessage) return 'lucide:alert-circle';
		if (isListening) return 'lucide:music';
		return 'lucide:volume-x';
	});

	const handleMessage: MessageCallbackFn = (message) => {
		try {
			match(message)
				.with({ type: 'bang' }, () => {
					startListening();
				})
				.with(
					{ type: 'set', deviceId: P.string, channel: P.number, events: P.array(P.string) },
					({ deviceId, channel, events }) => {
						updateNodeData(nodeId, {
							...data,
							...(deviceId !== undefined && { deviceId }),
							...(channel !== undefined && { channel }),
							...(events !== undefined && { events })
						});
					}
				)
				.with({ type: 'stop' }, () => {
					stopListening();
				});
		} catch (error) {
			errorMessage =
				'Failed to handle message: ' + (error instanceof Error ? error.message : String(error));
		}
	};

	async function startListening() {
		if (!deviceId) {
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

		const config: MIDIInputConfig = {
			deviceId,
			channel: channel === 0 ? undefined : channel,
			events
		};

		try {
			midiSystem.startListening(nodeId, config);
			isListening = true;
			errorMessage = null;
		} catch (error) {
			errorMessage = 'Failed to start MIDI listening';
			isListening = false;
		}
	}

	function stopListening() {
		midiSystem.stopListening(nodeId);
		isListening = false;
		errorMessage = null;
	}

	function toggleListening() {
		if (isListening) {
			stopListening();
		} else {
			startListening();
		}
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
		stopListening();
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
					<div class="font-mono text-xs font-medium text-zinc-400">midi.in</div>
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
							'flex w-full flex-col items-center justify-center rounded-md border bg-zinc-900 px-3 py-2 text-zinc-300 hover:bg-zinc-800',
							'border-amber-500'
						]}
						onclick={() => (showSettings = true)}
						title="Select MIDI device"
					>
						<Icon icon="lucide:settings" class="mb-1 h-4 w-4" />

						<div class="text-[10px]">
							<span class="text-amber-400">Select device</span>
						</div>
					</button>
				{:else}
					<button
						class={[
							'flex w-full flex-col items-center justify-center rounded-md border bg-zinc-900 p-3 pb-2 text-zinc-300 hover:bg-zinc-800',
							borderColor
						]}
						onclick={toggleListening}
						title={isListening ? 'Stop listening' : 'Start listening'}
					>
						<Icon icon={statusIcon} class="h-4 w-4" />

						<div class="mt-1 max-w-[100px] truncate text-[10px] text-zinc-500">
							{midiSystem.getInputById(deviceId)?.name || 'Unknown'}
						</div>
					</button>
				{/if}

				<StandardHandle port="outlet" type="message" total={1} index={0} />
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
									...data,
									deviceId: (e.target as HTMLSelectElement).value
								})}
						>
							<option value="">Select device...</option>
							{#each $midiInputDevices as device}
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
									...data,
									channel: parseInt((e.target as HTMLSelectElement).value)
								})}
						>
							<option value={0}>All channels</option>
							{#each Array(16) as _, i}
								<option value={i + 1}>Channel {i + 1}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="mb-2 block text-xs font-medium text-zinc-300">Message Types</label>
						<div class="space-y-1">
							{#each ['noteOn', 'noteOff', 'controlChange', 'programChange', 'pitchBend'] as msgType}
								<label class="flex items-center">
									<input
										type="checkbox"
										class="mr-2 h-3 w-3"
										checked={events.includes(msgType)}
										onchange={(e) => {
											const checked = (e.target as HTMLInputElement).checked;
											const newTypes = checked
												? [...events, msgType as EventType]
												: events.filter((t) => t !== msgType);
											updateNodeData(nodeId, { ...data, events: newTypes });
										}}
									/>
									<span class="text-xs text-zinc-300">{msgType}</span>
								</label>
							{/each}
						</div>
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
