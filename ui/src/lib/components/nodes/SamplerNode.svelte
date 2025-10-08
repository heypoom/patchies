<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioSystem } from '$lib/audio/AudioSystem';

	let node: {
		id: string;
		data: {
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
	let isPlaying = $state(false);
	let playbackProgress = $state(0);
	let playbackInterval: ReturnType<typeof setInterval> | null = null;

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

		// Clear any existing interval to prevent zombie intervals
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}

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
			hasRecording: true,
			duration: recordingDuration
		});
	}

	function playRecording() {
		if (!hasRecording) return;

		audioSystem.send(node.id, 'message', { type: 'play' });
		startPlaybackProgressBar();
	}

	function startPlaybackProgressBar() {
		// Clear any existing interval to prevent zombie intervals
		if (playbackInterval) {
			clearInterval(playbackInterval);
			playbackInterval = null;
		}

		isPlaying = true;
		playbackProgress = 0;

		// Start playback progress tracking
		playbackInterval = setInterval(() => {
			playbackProgress += 0.1;
			if (playbackProgress >= recordingDuration) {
				stopPlayback();
			}
		}, 100);
	}

	function stopPlaybackProgressBar() {
		isPlaying = false;
		playbackProgress = 0;

		if (playbackInterval) {
			clearInterval(playbackInterval);
			playbackInterval = null;
		}
	}

	function stopPlayback() {
		audioSystem.send(node.id, 'message', { type: 'stop' });
		stopPlaybackProgressBar();
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

		audioSystem.createAudioObject(node.id, 'sampler~', []);

		hasRecording = node.data.hasRecording || false;
		recordingDuration = node.data.duration || 0;
	});

	onDestroy(() => {
		if (recordingInterval) clearInterval(recordingInterval);
		if (playbackInterval) clearInterval(playbackInterval);

		// Stop any active recording/playback before cleanup
		if (isRecording) {
			audioSystem.send(node.id, 'message', { type: 'end' });
		}

		if (isPlaying) {
			audioSystem.send(node.id, 'message', { type: 'stop' });
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
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0 {isRecording
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
					{#if hasRecording && !isRecording}
						<button
							title="Play Recording"
							class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
							onclick={playRecording}
						>
							<Icon icon="lucide:play" class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}
				</div>
			</div>

			<div class="relative">
				<!-- Audio Input Handle -->
				<StandardHandle
					port="inlet"
					type="audio"
					id="audio-in"
					total={2}
					index={0}
					title="Audio input"
				/>

				<!-- Message Input Handle -->
				<StandardHandle
					port="inlet"
					type="message"
					id="message-in"
					total={2}
					index={1}
					title="Message input"
				/>

				<div
					class={[
						'relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-1',
						node.selected ? 'border-zinc-400 bg-zinc-800' : 'border-zinc-700 bg-zinc-900'
					]}
				>
					<!-- Playback Progress Bar -->
					{#if isPlaying && recordingDuration > 0}
						<div
							class="pointer-events-none absolute top-0 left-0 h-full bg-zinc-600/30 transition-all"
							style="width: {(playbackProgress / recordingDuration) * 100}%"
						></div>
					{/if}

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
				<StandardHandle
					port="outlet"
					type="audio"
					id="audio-out"
					total={1}
					index={0}
					title="Audio output"
				/>
			</div>
		</div>
	</div>
</div>
