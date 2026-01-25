<script lang="ts">
	import { Circle, Mic, Play, RefreshCcw, Settings, Square, X } from '@lucide/svelte/icons';
	import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import WaveformDisplay from '$lib/components/nodes/WaveformDisplay.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import type { SamplerNode as SamplerNodeV2 } from '$lib/audio/v2/nodes/SamplerNode';

	let node: NodeProps & {
		data: {
			hasRecording?: boolean;
			duration?: number;
			loopStart?: number;
			loopEnd?: number;
			loop?: boolean;
			playbackRate?: number;
			detune?: number;
			// Used when converting from soundfile~
			vfsPath?: string;
		};
	} = $props();

	const { updateNodeData } = useSvelteFlow();

	let messageContext: MessageContext;
	let audioService = AudioService.getInstance();
	let v2Node: SamplerNodeV2 | null = null;
	let isRecording = $state(false);
	let recordingInterval: ReturnType<typeof setInterval> | null = null;
	let isPlaying = $state(false);
	let playbackProgress = $state(0);
	let playbackInterval: ReturnType<typeof setInterval> | null = null;
	let audioBuffer = $state<AudioBuffer | null>(null);
	let showSettings = $state(false);
	let recordingAnalyser: AnalyserNode | null = null;
	let recordingAnimationFrame: number | null = null;
	let isDragging = $state(false);

	// Derive all state from node.data instead of duplicating
	const hasRecording = $derived(node.data.hasRecording || false);
	const recordingDuration = $derived(node.data.duration || 0);
	const loopStart = $derived(node.data.loopStart || 0);
	const loopEnd = $derived(node.data.loopEnd || recordingDuration);
	const loopEnabled = $derived(node.data.loop || false);
	const playbackRate = $derived(node.data.playbackRate || 1);
	const detune = $derived(node.data.detune || 0);

	// Use node dimensions if available, otherwise use defaults
	const width = $derived(node.width || 190);
	const height = $derived(node.height || 35);

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'record' }, () => startRecording())
			.with({ type: 'end' }, () => stopRecording())
			.with({ type: P.union('bang', 'play') }, () => playRecording())
			.with({ type: 'stop' }, () => stopPlayback())
			.with({ type: 'loop', start: P.optional(P.number), end: P.optional(P.number) }, (msg) => {
				updateNodeData(node.id, {
					...node.data,
					...(msg.start !== undefined ? { loopStart: msg.start } : {}),
					...(msg.end !== undefined ? { loopEnd: msg.end } : {})
				});

				toggleLoop();
			})
			.with({ type: 'loopOn', start: P.optional(P.number), end: P.optional(P.number) }, (msg) => {
				updateNodeData(node.id, {
					...node.data,
					loop: true,
					...(msg.start !== undefined ? { loopStart: msg.start } : {}),
					...(msg.end !== undefined ? { loopEnd: msg.end } : {})
				});

				audioService.send(node.id, 'message', {
					type: 'loop',
					...(msg.start !== undefined ? { start: msg.start } : {}),
					...(msg.end !== undefined ? { end: msg.end } : {})
				});
			})
			.with({ type: 'loopOff' }, () => {
				updateNodeData(node.id, { ...node.data, loop: false });
				audioService.send(node.id, 'message', { type: 'loopOff' });
			})
			.with({ type: 'setStart', value: P.number }, (msg) => {
				updateNodeData(node.id, { ...node.data, loopStart: msg.value });
				audioService.send(node.id, 'message', { type: 'setStart', value: msg.value });
			})
			.with({ type: 'setEnd', value: P.number }, (msg) => {
				updateNodeData(node.id, { ...node.data, loopEnd: msg.value });
				audioService.send(node.id, 'message', { type: 'setEnd', value: msg.value });
			})
			.with({ type: 'setPlaybackRate', value: P.number }, (msg) => {
				updateNodeData(node.id, { ...node.data, playbackRate: msg.value });
				audioService.send(node.id, 'message', { type: 'setPlaybackRate', value: msg.value });
			})
			.with({ type: 'setDetune', value: P.number }, (msg) => {
				updateNodeData(node.id, { ...node.data, detune: msg.value });
				audioService.send(node.id, 'message', { type: 'setDetune', value: msg.value });
			})
			.otherwise(() => audioService.send(node.id, 'message', message));
	};

	function startRecording() {
		if (isRecording) return;

		// Clear any existing interval to prevent zombie intervals
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}

		// Clear old audio buffer and waveform
		audioBuffer = null;

		// Reset start/end points for new recording
		updateNodeData(node.id, {
			...node.data,
			hasRecording: false,
			loopStart: 0,
			loopEnd: 0,
			duration: 0
		});

		// Create analyser for real-time waveform visualization
		if (v2Node) {
			const audioCtx = audioService.getAudioContext();
			recordingAnalyser = audioCtx.createAnalyser();
			recordingAnalyser.fftSize = 2048;

			// Connect the destination node to the analyser
			const source = audioCtx.createMediaStreamSource(v2Node.destinationStream);
			source.connect(recordingAnalyser);
		}

		audioService.send(node.id, 'message', { type: 'record' });
		isRecording = true;

		// Start duration timer
		let currentDuration = 0;
		recordingInterval = setInterval(() => {
			currentDuration += 0.1;
			updateNodeData(node.id, { ...node.data, duration: currentDuration });
		}, 100);
	}

	async function stopRecording() {
		if (!isRecording) return;

		audioService.send(node.id, 'message', { type: 'end' });
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
			if (v2Node && v2Node.audioBuffer) {
				audioBuffer = v2Node.audioBuffer;
				const duration = audioBuffer.duration;

				updateNodeData(node.id, {
					...node.data,
					hasRecording: true,
					duration: duration,
					loopEnd: duration
				});

				// Update AudioSystem's loop end point as well
				audioService.send(node.id, 'message', {
					type: 'setEnd',
					value: duration
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
			audioService.send(node.id, 'message', { type: 'loop', start: loopStart, end: loopEnd });
		} else {
			audioService.send(node.id, 'message', { type: 'play' });
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
		audioService.send(node.id, 'message', { type: 'stop' });
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
		const newLoopEnabled = !loopEnabled;
		updateNodeData(node.id, { ...node.data, loop: newLoopEnabled });

		if (newLoopEnabled) {
			audioService.send(node.id, 'message', { type: 'loop', start: loopStart, end: loopEnd });
		} else {
			audioService.send(node.id, 'message', { type: 'loopOff' });
		}
	}

	function updateLoopStart(value: number) {
		const newLoopStart = Math.max(0, Math.min(value, loopEnd));
		updateNodeData(node.id, { ...node.data, loopStart: newLoopStart });
		audioService.send(node.id, 'message', { type: 'setStart', value: newLoopStart });
	}

	function updateLoopEnd(value: number) {
		const newLoopEnd = Math.max(loopStart, Math.min(value, recordingDuration));
		updateNodeData(node.id, { ...node.data, loopEnd: newLoopEnd });
		audioService.send(node.id, 'message', { type: 'setEnd', value: newLoopEnd });
	}

	function updatePlaybackRate(value: number) {
		updateNodeData(node.id, { ...node.data, playbackRate: value });
		audioService.send(node.id, 'message', { type: 'setPlaybackRate', value });
	}

	function updateDetune(value: number) {
		updateNodeData(node.id, { ...node.data, detune: value });
		audioService.send(node.id, 'message', { type: 'setDetune', value });
	}

	function resetSettings() {
		updateNodeData(node.id, {
			...node.data,
			loopStart: 0,
			loopEnd: recordingDuration,
			loop: false,
			playbackRate: 1,
			detune: 0
		});

		// Update AudioService
		audioService.send(node.id, 'message', { type: 'setStart', value: 0 });
		audioService.send(node.id, 'message', { type: 'setEnd', value: recordingDuration });
		audioService.send(node.id, 'message', { type: 'loopOff' });
		audioService.send(node.id, 'message', { type: 'setPlaybackRate', value: 1 });
		audioService.send(node.id, 'message', { type: 'setDetune', value: 0 });
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.type.startsWith('audio/')) {
			console.warn('Only audio files are supported');
			return;
		}

		await loadAudioFile(file);
	}

	async function loadAudioFile(file: File) {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const decodedBuffer = await audioService.getAudioContext().decodeAudioData(arrayBuffer);

			// Set the audio buffer on the V2 node
			if (v2Node) {
				v2Node.audioBuffer = decodedBuffer;
			}

			audioBuffer = decodedBuffer;
			const duration = decodedBuffer.duration;

			updateNodeData(node.id, {
				...node.data,
				hasRecording: true,
				duration: duration,
				loopStart: 0,
				loopEnd: duration
			});

			// Update AudioService's loop end point
			audioService.send(node.id, 'message', { type: 'setEnd', value: duration });
		} catch (error) {
			console.error('Failed to load audio file:', error);
		}
	}

	onMount(async () => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		audioService.createNode(node.id, 'sampler~', []);

		// Get the V2 node reference from AudioService
		v2Node = audioService.getNodeById(node.id) as SamplerNodeV2;

		// Initialize with playbackRate and detune from node.data
		if (v2Node) {
			// Send initialization messages for playbackRate and detune
			if (node.data.playbackRate) {
				audioService.send(node.id, 'message', {
					type: 'setPlaybackRate',
					value: node.data.playbackRate
				});
			}

			if (node.data.detune) {
				audioService.send(node.id, 'message', { type: 'setDetune', value: node.data.detune });
			}

			// Get audio buffer if it exists
			if (v2Node.audioBuffer) {
				audioBuffer = v2Node.audioBuffer;
			}

			// Load audio from soundfile~ conversion (VFS path)
			if (node.data.vfsPath) {
				try {
					const { VirtualFilesystem } = await import('$lib/vfs');

					const vfs = VirtualFilesystem.getInstance();
					const fileOrBlob = await vfs.resolve(node.data.vfsPath);

					const arrayBuffer = await fileOrBlob.arrayBuffer();
					const decodedBuffer = await audioService.getAudioContext().decodeAudioData(arrayBuffer);

					v2Node.audioBuffer = decodedBuffer;
					audioBuffer = decodedBuffer;
				} catch (error) {
					console.error('Failed to load audio from VFS path:', error);
				}
			}
		}
	});

	onDestroy(() => {
		if (recordingInterval) clearInterval(recordingInterval);
		if (playbackInterval) clearInterval(playbackInterval);

		// Stop any active recording/playback before cleanup
		if (isRecording) {
			audioService.send(node.id, 'message', { type: 'end' });
		}

		if (isPlaying) {
			audioService.send(node.id, 'message', { type: 'stop' });
		}

		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();
		audioService.removeNodeById(node.id);
	});

	const containerClass = $derived.by(() => {
		if (isDragging) return 'border-blue-400 bg-blue-50/10';
		if (node.data.loop && node.selected) return 'border-orange-300 bg-zinc-800 shadow-glow-md';
		if (node.selected) return 'object-container-selected';
		if (node.data.loop) return 'border-orange-400 bg-zinc-900 hover:shadow-glow-sm';
		return 'object-container';
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
						<svelte:component
							this={isRecording ? Square : Circle}
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
							<Play class="h-4 w-4 text-zinc-300" />
						</button>
					{/if}

					<button
						class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
						onclick={() => (showSettings = !showSettings)}
						title="Settings"
					>
						<Settings class="h-4 w-4 text-zinc-300" />
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
					nodeId={node.id}
				/>

				<!-- Message Input Handle -->
				<StandardHandle
					port="inlet"
					type="message"
					id="message-in"
					total={2}
					index={1}
					title="Message input"
					nodeId={node.id}
				/>

				<div
					class={[
						'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border-1',
						containerClass
					]}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
					role="figure"
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
							<Mic class="h-4 w-4 text-zinc-400" />
							<div class="font-mono text-[12px] font-light text-zinc-400">
								{#if isDragging}
									Drop audio file
								{:else}
									Record or drop file
								{/if}
							</div>
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
					nodeId={node.id}
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
					<RefreshCcw class="h-4 w-4 text-zinc-300" />
				</button>

				<button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
					<X class="h-4 w-4 text-zinc-300" />
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
