<script lang="ts">
	import { Handle, Position, useSvelteFlow } from '@xyflow/svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';
	import { getPortPosition } from '$lib/utils/node-utils';

	let node: {
		id: string;
		data: {
			isRecording?: boolean;
			hasRecording?: boolean;
			duration?: number;
		};
		selected: boolean;
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let audioSystem = AudioSystem.getInstance();
	let isRecording = $state(false);
	let hasRecording = $state(false);
	let recordingDuration = $state(0);
	let recordingInterval: ReturnType<typeof setInterval> | null = null;

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'record' }, () => startRecording())
			.with({ type: 'end' }, () => stopRecording())
			.with({ type: P.union('bang', 'play') }, () => playRecording())
			.with({ type: 'stop' }, () => stopPlayback())
			.otherwise(() => audioSystem.send(node.id, 'message', message));
	};

	function startRecording() {
		if (isRecording) return;

		audioSystem.send(node.id, 'message', { type: 'record' });
		isRecording = true;
		recordingDuration = 0;

		// Start duration timer
		recordingInterval = setInterval(() => {
			recordingDuration += 0.1;
		}, 100);

		updateNodeData(node.id, { ...node.data, isRecording: true });
	}

	function stopRecording() {
		if (!isRecording) return;

		audioSystem.send(node.id, 'message', { type: 'end' });
		isRecording = false;
		hasRecording = true;

		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}

		updateNodeData(node.id, {
			...node.data,
			isRecording: false,
			hasRecording: true,
			duration: recordingDuration
		});
	}

	function playRecording() {
		if (!hasRecording) return;

		audioSystem.send(node.id, 'message', { type: 'play' });
	}

	function stopPlayback() {
		audioSystem.send(node.id, 'message', { type: 'stop' });
	}

	function toggleRecording() {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		// Create sampler audio object
		audioSystem.createAudioObject(node.id, 'sampler~', []);

		// Restore state from node data
		isRecording = node.data.isRecording || false;
		hasRecording = node.data.hasRecording || false;
		recordingDuration = node.data.duration || 0;
	});

	onDestroy(() => {
		if (recordingInterval) {
			clearInterval(recordingInterval);
		}

		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		audioSystem.removeAudioObject(node.id);
	});
</script>

<div class="relative flex gap-x-3">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
				<div></div>

				<div class="flex gap-1">
					<!-- Record Button -->
					<button
						title={isRecording ? 'Stop Recording' : 'Start Recording'}
						class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100 {isRecording
							? '!opacity-100'
							: ''}"
						onclick={toggleRecording}
					>
						<Icon
							icon={isRecording ? 'lucide:square' : 'lucide:circle'}
							class="h-4 w-4 {isRecording ? 'text-red-500' : 'text-zinc-300'}"
						/>
					</button>

					<!-- Play Button -->
					{#if hasRecording}
						<button
							title="Play Recording"
							class="rounded p-1 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
							onclick={playRecording}
						>
							<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}
				</div>
			</div>

			<div class="relative">
				<!-- Audio Input Handle -->
				<Handle
					type="target"
					position={Position.Top}
					id="audio-in"
					style={`left: ${getPortPosition(2, 0)}`}
					class="!bg-blue-500"
					title="Audio input"
				/>

				<!-- Message Input Handle -->
				<Handle
					type="target"
					position={Position.Top}
					id="msg-in"
					style={`left: ${getPortPosition(2, 1)}`}
					title="Message input"
				/>

				<div
					class="border-1 flex flex-col items-center justify-center gap-3 rounded-lg border-zinc-700 bg-zinc-900"
				>
					<div class="flex items-center justify-center gap-2 px-3 py-[7px]">
						{#if isRecording}
							<Icon icon="lucide:circle" class="h-4 w-4 animate-pulse text-red-500" />
							<div class="font-mono text-[12px] text-zinc-300">
								Recording... {recordingDuration.toFixed(1)}s
							</div>
						{:else if hasRecording}
							<Icon icon="lucide:mic" class="h-4 w-4 text-zinc-500" />
							<div class="text-center font-mono">
								<div class="text-[12px] font-light text-zinc-300">
									Sample ({recordingDuration.toFixed(1)}s)
								</div>
							</div>
						{:else}
							<Icon icon="lucide:mic" class="h-4 w-4 text-zinc-400" />
							<div class="font-mono text-[12px] font-light text-zinc-400">Ready to record</div>
						{/if}
					</div>
				</div>

				<!-- Audio Output Handle -->
				<Handle
					type="source"
					position={Position.Bottom}
					class="!bg-blue-500"
					title="Audio output"
				/>
			</div>
		</div>
	</div>
</div>
