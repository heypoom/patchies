<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import WaveformDisplay from '$lib/components/nodes/WaveformDisplay.svelte';
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
			loopStart?: number;
			loopEnd?: number;
			loop?: boolean;
			playbackRate?: number;
			detune?: number;
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
	let audioBuffer = $state<AudioBuffer | null>(null);
	let showSettings = $state(false);
	let recordingAnalyser: AnalyserNode | null = null;
	let recordingAnimationFrame: number | null = null;

	// Loop settings
	let loopEnabled = $state(node.data.loop || false);
	let loopStart = $state(node.data.loopStart || 0);
	let loopEnd = $state(node.data.loopEnd || 0);
	let playbackRate = $state(node.data.playbackRate || 1);
	let detune = $state(node.data.detune || 0);

	const width = 190;
	const height = 35;

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'record' }, () => startRecording())
			.with({ type: 'end' }, () => stopRecording())
			.with({ type: P.union('bang', 'play') }, () => playRecording())
			.with({ type: 'stop' }, () => stopPlayback())
			.with({ type: 'loop', start: P.optional(P.number), end: P.optional(P.number) }, (msg) => {
				loopEnabled = true;
				if (msg.start !== undefined) loopStart = msg.start;
				if (msg.end !== undefined) loopEnd = msg.end;
				updateNodeData(node.id, {
					...node.data,
					loop: true,
					loopStart,
					loopEnd
				});
				audioSystem.send(node.id, 'message', { type: 'loop', start: loopStart, end: loopEnd });
			})
			.with({ type: 'noloop' }, () => {
				loopEnabled = false;
				updateNodeData(node.id, { ...node.data, loop: false });
				audioSystem.send(node.id, 'message', { type: 'noloop' });
			})
			.with({ type: 'setStart', value: P.number }, (msg) => {
				loopStart = msg.value;
				updateNodeData(node.id, { ...node.data, loopStart });
				audioSystem.send(node.id, 'message', { type: 'setStart', value: msg.value });
			})
			.with({ type: 'setEnd', value: P.number }, (msg) => {
				loopEnd = msg.value;
				updateNodeData(node.id, { ...node.data, loopEnd });
				audioSystem.send(node.id, 'message', { type: 'setEnd', value: msg.value });
			})
			.with({ type: 'playbackRate', value: P.number }, (msg) => {
				playbackRate = msg.value;
				updateNodeData(node.id, { ...node.data, playbackRate });
				audioSystem.send(node.id, 'message', { type: 'playbackRate', value: msg.value });
			})
			.with({ type: 'detune', value: P.number }, (msg) => {
				detune = msg.value;
				updateNodeData(node.id, { ...node.data, detune });
				audioSystem.send(node.id, 'message', { type: 'detune', value: msg.value });
			})
			.otherwise(() => audioSystem.send(node.id, 'message', message));
	};

	function startRecording() {
		if (isRecording) return;

		// Clear any existing interval to prevent zombie intervals
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}

		// Reset start/end points for new recording
		loopStart = 0;
		loopEnd = 0;

		// Create analyser for real-time waveform visualization
		const samplerNode = audioSystem.nodesById.get(node.id);
		if (samplerNode?.type === 'sampler~') {
			const audioCtx = audioSystem.audioContext;
			recordingAnalyser = audioCtx.createAnalyser();
			recordingAnalyser.fftSize = 2048;

			// Connect the destination node to the analyser
			const source = audioCtx.createMediaStreamSource(samplerNode.destinationNode.stream);
			source.connect(recordingAnalyser);
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

	async function stopRecording() {
		if (!isRecording) return;

		audioSystem.send(node.id, 'message', { type: 'end' });
		isRecording = false;

		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}

		// Clean up analyser and animation
		if (recordingAnimationFrame) {
			cancelAnimationFrame(recordingAnimationFrame);
			recordingAnimationFrame = null;
		}
		if (recordingAnalyser) {
			recordingAnalyser.disconnect();
			recordingAnalyser = null;
		}

		// Wait for the MediaRecorder to process the recording
		// Poll for the audioBuffer to be available
		let attempts = 0;
		const maxAttempts = 50; // 5 seconds max wait

		while (attempts < maxAttempts) {
			const samplerNode = audioSystem.nodesById.get(node.id);

			if (samplerNode?.type === 'sampler~' && samplerNode.audioBuffer) {
				audioBuffer = samplerNode.audioBuffer;
				hasRecording = true;

				// Set end point to the actual recording duration
				loopEnd = recordingDuration;

				updateNodeData(node.id, {
					...node.data,
					hasRecording: true,
					duration: recordingDuration,
					loopEnd: loopEnd
				});

				// Update AudioSystem's loop end point as well
				audioSystem.send(node.id, 'message', {
					type: 'setEnd',
					value: loopEnd
				});

				return;
			}

			await new Promise((resolve) => setTimeout(resolve, 100));
			attempts++;
		}

		console.error('Failed to retrieve audio buffer after recording');
	}

	function playRecording() {
		if (!hasRecording) return;

		if (loopEnabled && loopEnd > loopStart) {
			audioSystem.send(node.id, 'message', { type: 'loop', start: loopStart, end: loopEnd });
		} else {
			audioSystem.send(node.id, 'message', { type: 'play' });
		}

		startPlaybackProgressBar();
	}

	function startPlaybackProgressBar() {
		// Clear any existing interval to prevent zombie intervals
		if (playbackInterval) {
			clearInterval(playbackInterval);
			playbackInterval = null;
		}

		isPlaying = true;
		playbackProgress = loopStart;

		// Calculate the effective end point
		const effectiveEnd = loopEnd > loopStart ? loopEnd : recordingDuration;

		// Start playback progress tracking
		playbackInterval = setInterval(() => {
			// Advance playback progress based on playbackRate
			playbackProgress += 0.1 * playbackRate;

			if (loopEnabled) {
				// Loop back to start if we reach the end
				if (playbackProgress >= effectiveEnd) {
					playbackProgress = loopStart;
				}
			} else {
				// Stop if we reach the end (non-looping)
				if (playbackProgress >= effectiveEnd) {
					stopPlayback();
				}
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

	function toggleLoop() {
		loopEnabled = !loopEnabled;
		updateNodeData(node.id, { ...node.data, loop: loopEnabled });

		if (loopEnabled) {
			audioSystem.send(node.id, 'message', { type: 'loop', start: loopStart, end: loopEnd });
		} else {
			audioSystem.send(node.id, 'message', { type: 'noloop' });
		}
	}

	function updateLoopStart(value: number) {
		loopStart = Math.max(0, Math.min(value, loopEnd));
		updateNodeData(node.id, { ...node.data, loopStart });
		audioSystem.send(node.id, 'message', { type: 'setStart', value: loopStart });
	}

	function updateLoopEnd(value: number) {
		loopEnd = Math.max(loopStart, Math.min(value, recordingDuration));
		updateNodeData(node.id, { ...node.data, loopEnd });
		audioSystem.send(node.id, 'message', { type: 'setEnd', value: loopEnd });
	}

	function updatePlaybackRate(value: number) {
		playbackRate = value;
		updateNodeData(node.id, { ...node.data, playbackRate });
		audioSystem.send(node.id, 'message', { type: 'playbackRate', value: playbackRate });
	}

	function updateDetune(value: number) {
		detune = value;
		updateNodeData(node.id, { ...node.data, detune });
		audioSystem.send(node.id, 'message', { type: 'detune', value: detune });
	}

	function resetSettings() {
		// Reset to defaults
		loopStart = 0;
		loopEnd = recordingDuration;
		loopEnabled = false;
		playbackRate = 1;
		detune = 0;

		// Update node data
		updateNodeData(node.id, {
			...node.data,
			loopStart: 0,
			loopEnd: recordingDuration,
			loop: false,
			playbackRate: 1,
			detune: 0
		});

		// Update AudioSystem
		audioSystem.send(node.id, 'message', { type: 'setStart', value: 0 });
		audioSystem.send(node.id, 'message', { type: 'setEnd', value: recordingDuration });
		audioSystem.send(node.id, 'message', { type: 'noloop' });
		audioSystem.send(node.id, 'message', { type: 'playbackRate', value: 1 });
		audioSystem.send(node.id, 'message', { type: 'detune', value: 0 });
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		audioSystem.createAudioObject(node.id, 'sampler~', []);

		hasRecording = node.data.hasRecording || false;
		recordingDuration = node.data.duration || 0;
		loopStart = node.data.loopStart || 0;
		loopEnd = node.data.loopEnd || recordingDuration;
		loopEnabled = node.data.loop || false;
		playbackRate = node.data.playbackRate || 1;
		detune = node.data.detune || 0;

		// Initialize AudioSystem with playbackRate and detune
		const samplerNode = audioSystem.nodesById.get(node.id);
		if (samplerNode?.type === 'sampler~') {
			samplerNode.playbackRate = playbackRate;
			samplerNode.detune = detune;

			// Get audio buffer if it exists
			if (samplerNode.audioBuffer) {
				audioBuffer = samplerNode.audioBuffer;
			}
		}
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

					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={() => (showSettings = !showSettings)}
						title="Settings"
					>
						<Icon icon="lucide:settings" class="h-4 w-4 text-zinc-300" />
					</button>
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
						'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border-1',
						node.selected ? 'border-zinc-400 bg-zinc-800' : 'border-zinc-700 bg-zinc-900'
					]}
				>
					{#if isRecording && recordingAnalyser}
						<WaveformDisplay analyser={recordingAnalyser} {width} {height} />
					{:else if hasRecording && audioBuffer}
						<WaveformDisplay
							{audioBuffer}
							{loopStart}
							{loopEnd}
							{playbackProgress}
							{width}
							{height}
							showLoopPoints={loopStart > 0.05 || Math.abs(loopEnd - recordingDuration) > 0.05}
						/>
					{:else}
						<div
							class="flex items-center justify-center gap-2 px-3"
							style="height: {height}px; width: {width}px;"
						>
							<Icon icon="lucide:mic" class="h-4 w-4 text-zinc-400" />
							<div class="font-mono text-[12px] font-light text-zinc-400">Ready to record</div>
						</div>
					{/if}
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

	{#if showSettings && hasRecording}
		<div class="relative">
			<div class="absolute -top-7 left-0 flex w-full justify-end gap-1">
				<button
					onclick={resetSettings}
					class="rounded p-1 hover:bg-zinc-700"
					title="Reset all settings"
				>
					<Icon icon="lucide:refresh-ccw" class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<Icon icon="lucide:x" class="h-4 w-4 text-zinc-300" />
				</button>
			</div>

			<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
				<div class="space-y-4">
					<div>
						<div class="mb-2 text-xs font-medium text-zinc-300">Playback Settings</div>

						<!-- Start Point -->
						<div class="mb-3">
							<div class="mb-1 flex items-center justify-between">
								<label class="text-xs text-zinc-400">Start (s)</label>
								<span class="font-mono text-xs text-zinc-300">{loopStart.toFixed(2)}</span>
							</div>
							<input
								type="range"
								min="0"
								max={recordingDuration}
								step="0.01"
								value={loopStart}
								oninput={(e) => updateLoopStart(parseFloat(e.currentTarget.value))}
								class="w-full"
							/>
						</div>

						<!-- End Point -->
						<div class="mb-3">
							<div class="mb-1 flex items-center justify-between">
								<label class="text-xs text-zinc-400">End (s)</label>
								<span class="font-mono text-xs text-zinc-300">{loopEnd.toFixed(2)}</span>
							</div>
							<input
								type="range"
								min="0"
								max={recordingDuration}
								step="0.01"
								value={loopEnd}
								oninput={(e) => updateLoopEnd(parseFloat(e.currentTarget.value))}
								class="w-full"
							/>
						</div>

						<!-- Loop Toggle -->
						<div class="mb-3 flex items-center justify-between border-t border-zinc-700 pt-3">
							<span class="text-xs text-zinc-400">Loop</span>
							<button
								onclick={toggleLoop}
								class="rounded px-2 py-1 text-xs {loopEnabled
									? 'bg-orange-500 text-white'
									: 'bg-zinc-700 text-zinc-300'}"
							>
								{loopEnabled ? 'On' : 'Off'}
							</button>
						</div>

						<!-- Playback Rate -->
						<div class="mb-3 border-t border-zinc-700 pt-3">
							<div class="mb-1 flex items-center justify-between">
								<label class="text-xs text-zinc-400">Playback Rate</label>
								<span class="font-mono text-xs text-zinc-300">{playbackRate.toFixed(2)}</span>
							</div>
							<input
								type="range"
								min="0.25"
								max="4"
								step="0.01"
								value={playbackRate}
								oninput={(e) => updatePlaybackRate(parseFloat(e.currentTarget.value))}
								class="w-full"
							/>
						</div>

						<!-- Detune -->
						<div class="mb-3">
							<div class="mb-1 flex items-center justify-between">
								<label class="text-xs text-zinc-400">Detune (cents)</label>
								<span class="font-mono text-xs text-zinc-300">{detune.toFixed(0)}</span>
							</div>
							<input
								type="range"
								min="-1200"
								max="1200"
								step="1"
								value={detune}
								oninput={(e) => updateDetune(parseFloat(e.currentTarget.value))}
								class="w-full"
							/>
						</div>
					</div>

					<!-- Sample Info -->
					<div class="border-t border-zinc-700 pt-3">
						<div class="text-xs text-zinc-500">
							Duration: {recordingDuration.toFixed(2)}s
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
