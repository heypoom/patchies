<script lang="ts">
  import { Circle, Mic, Play, Settings, Square } from '@lucide/svelte/icons';
  import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import WaveformDisplay from '$objects/sampler~/WaveformDisplay.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { getPatchRuntime, getPatchRuntimeViewRevisionTracker } from '$lib/runtime';
  import { downloadAsWav } from '$lib/audio/wav-encoder';
  import {
    createSamplerPlaybackMessage,
    type SamplerPlaybackTrigger
  } from '$lib/audio/sampler-playback-message';
  import {
    addSamplerPlaybackProgressVoice,
    advanceSamplerPlaybackProgress,
    removeSamplerPlaybackProgressVoice,
    type SamplerPlaybackProgressVoice
  } from '$objects/sampler~/sampler-playback-progress';
  import { SamplerNode as SamplerNodeV2 } from '$objects/sampler~/SamplerNode';
  import type {
    SamplerPlaybackStartEvent,
    SamplerPlaybackStopEvent
  } from '$objects/sampler~/SamplerNode';
  import { useVfsMedia } from '$lib/vfs';
  import { VfsRelinkOverlay } from '$lib/vfs/components';
  import { useNodeDataTracker } from '$lib/history';
  import SamplerSettings from '$lib/components/settings/SamplerSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let node: NodeProps & {
    data: {
      hasRecording?: boolean;
      duration?: number;
      loopStart?: number;
      loopEnd?: number;
      loop?: boolean;
      gain?: number;
      playbackRate?: number;
      detune?: number;
      noteOffMode?: 'one-shot' | 'held';

      // Used when converting from soundfile~
      vfsPath?: string;
    };
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  function getInitialNodeId() {
    return node.id;
  }

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(getInitialNodeId());
  const loopStartTracker = tracker.track('loopStart', () => node.data.loopStart ?? 0);
  const loopEndTracker = tracker.track('loopEnd', () => node.data.loopEnd ?? recordingDuration);
  const gainTracker = tracker.track('gain', () => node.data.gain ?? 1);
  const playbackRateTracker = tracker.track('playbackRate', () => node.data.playbackRate ?? 1);
  const detuneTracker = tracker.track('detune', () => node.data.detune ?? 0);

  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(10);
  let audioService = AudioService.getInstance();
  const patchRuntime = getPatchRuntime();
  const runtimeViewRevisionTracker = getPatchRuntimeViewRevisionTracker();
  let v2Node: SamplerNodeV2 | null = null;
  let isRecording = $state(false);
  let recordingInterval: ReturnType<typeof setInterval> | null = null;
  let activePlaybackVoices = $state(new Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>());
  let playbackProgress = $state(0);
  let playbackInterval: ReturnType<typeof setInterval> | null = null;
  let audioBuffer = $state<AudioBuffer | null>(null);
  let showSettings = $state(false);
  let recordingAnalyser = $state<AnalyserNode | null>(null);
  let recordingAnimationFrame: number | null = null;

  // Use VFS media composable for file handling (drag/drop, persistence, relink)
  const vfsMedia = useVfsMedia({
    nodeId: getInitialNodeId(),
    acceptMimePrefix: 'audio/',
    onFileLoaded: handleFileLoaded,
    updateNodeData: (data) => updateNodeData(node.id, data),
    getVfsPath: () => node.data.vfsPath,
    filePickerAccept: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
    filePickerDescription: 'Audio Files'
  });

  /**
   * Called when VFS successfully loads a file.
   * Decodes audio and sets up the sampler.
   * For URL-backed VFS entries, `sourceUrl` is provided and the file is fetched
   * from the URL directly (the `file` arg is a metadata-only placeholder).
   */
  async function handleFileLoaded(file: File, sourceUrl?: string) {
    try {
      let arrayBuffer: ArrayBuffer;

      if (sourceUrl) {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
        arrayBuffer = await response.arrayBuffer();
      } else {
        arrayBuffer = await file.arrayBuffer();
      }

      const decodedBuffer = await audioService.getAudioContext().decodeAudioData(arrayBuffer);

      audioBuffer = decodedBuffer;
      const duration = decodedBuffer.duration;

      updateNodeData(node.id, {
        hasRecording: true,
        duration: duration,
        loopStart: 0,
        loopEnd: duration
      });

      vfsMedia.markLoaded();
    } catch (error) {
      console.error('Failed to load audio file:', error);
    }
  }

  /**
   * Handle Float32Array input (e.g., from uiua node).
   * Creates AudioBuffer for UI display and sends to audio node.
   */
  function handleFloat32ArrayInput(samples: Float32Array) {
    // Create AudioBuffer for UI waveform display
    const sampleRate = audioService.getAudioContext().sampleRate;
    const buffer = audioService.getAudioContext().createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(new Float32Array(samples), 0);

    // Update UI state
    audioBuffer = buffer;
    const duration = buffer.duration;

    persistRuntimeBufferMetadata(buffer, duration);
  }

  // Derive all state from node.data instead of duplicating
  const hasRecording = $derived(node.data.hasRecording || false);
  const recordingDuration = $derived(node.data.duration || 0);
  const loopStart = $derived(node.data.loopStart || 0);
  const loopEnd = $derived(node.data.loopEnd || recordingDuration);
  const loopEnabled = $derived(node.data.loop || false);
  const gain = $derived(node.data.gain ?? 1);
  const playbackRate = $derived(node.data.playbackRate || 1);
  const detune = $derived(node.data.detune || 0);
  const noteOffMode = $derived(node.data.noteOffMode ?? 'one-shot');

  // Use node dimensions if available, otherwise use defaults
  const width = $derived(node.width || 190);
  const height = $derived(node.height || 35);

  const handleRuntimeMessage = (message: unknown) => {
    if (message instanceof Float32Array) {
      handleFloat32ArrayInput(message);
    }
  };

  $effect(() => {
    runtimeViewRevisionTracker?.trackObjectViewRevision(node.id);

    const runtimeNode = audioService.getNodeById(node.id);
    const samplerNode = runtimeNode instanceof SamplerNodeV2 ? runtimeNode : null;

    if (samplerNode === v2Node) {
      audioBuffer = samplerNode?.audioBuffer ?? null;
      return;
    }

    if (v2Node) {
      v2Node.onPlaybackStart = undefined;
      v2Node.onPlaybackStop = undefined;
      v2Node.onRecordingComplete = undefined;
    }

    v2Node = samplerNode;
    if (!v2Node) return;

    v2Node.onPlaybackStart = startPlaybackProgressBar;
    v2Node.onPlaybackStop = stopPlaybackProgressBar;
    v2Node.onRecordingComplete = (recordedBuffer) => {
      audioBuffer = recordedBuffer;
      persistRuntimeBufferMetadata(recordedBuffer, recordedBuffer.duration);
    };
    audioBuffer = v2Node.audioBuffer;

    if (audioBuffer && !hasRecording) {
      persistRuntimeBufferMetadata(audioBuffer, audioBuffer.duration);
    }
  });

  $effect(() => patchRuntime?.subscribeObjectMessages(node.id, handleRuntimeMessage) ?? undefined);

  function startRecording() {
    if (isRecording) return;

    // Clear any existing interval to prevent zombie intervals
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }

    // Clear old audio buffer and waveform
    audioBuffer = null;

    audioService.send(node.id, 'message', { type: 'record' });
    patchRuntime?.suppressNextAudioObjectSync(node.id);

    // Reset start/end points for the new recording without recreating its runtime node.
    updateNodeData(node.id, {
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

    isRecording = true;

    // Start duration timer
    let currentDuration = 0;
    recordingInterval = setInterval(() => {
      currentDuration += 0.1;
      updateNodeData(node.id, { duration: currentDuration });
    }, 100);
  }

  function stopRecording() {
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
  }

  function persistRuntimeBufferMetadata(buffer: AudioBuffer, duration: number) {
    audioBuffer = buffer;
    audioService.send(node.id, 'message', { type: 'setEnd', value: duration });
    patchRuntime?.suppressNextAudioObjectSync(node.id);

    updateNodeData(node.id, {
      hasRecording: true,
      duration,
      loopStart: 0,
      loopEnd: duration
    });
  }

  function playRecording(trigger: SamplerPlaybackTrigger = { type: 'bang' }) {
    const message = createSamplerPlaybackMessage(trigger, {
      hasRecording,
      loopEnabled,
      loopStart,
      loopEnd
    });

    if (!message) return;

    audioService.send(node.id, 'message', message);
  }

  function startPlaybackProgressBar(event: SamplerPlaybackStartEvent) {
    activePlaybackVoices = addSamplerPlaybackProgressVoice(activePlaybackVoices, {
      event,
      loopStart,
      loopEnd,
      recordingDuration
    });
    playbackProgress = event.offset;

    if (!playbackInterval) {
      playbackInterval = setInterval(() => {
        const result = advanceSamplerPlaybackProgress(activePlaybackVoices, {
          loopEnabled,
          loopStart,
          stepSeconds: 0.1
        });

        activePlaybackVoices = result.voices;
        playbackProgress = result.progress;

        if (result.shouldStopPlayback) {
          stopPlayback();
        }
      }, 100);
    }
  }

  function stopPlaybackProgressBar(event?: SamplerPlaybackStopEvent) {
    if (event) {
      activePlaybackVoices = removeSamplerPlaybackProgressVoice(activePlaybackVoices, event.source);
    } else {
      activePlaybackVoices = new Map();
    }

    if (activePlaybackVoices.size === 0) {
      playbackProgress = 0;

      if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
      }
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
    updateNodeData(node.id, { loop: newLoopEnabled });

    if (newLoopEnabled) {
      audioService.send(node.id, 'message', { type: 'loop', start: loopStart, end: loopEnd });
    } else {
      audioService.send(node.id, 'message', { type: 'loopOff' });
    }
  }

  function updateLoopStart(value: number) {
    const newLoopStart = Math.max(0, Math.min(value, loopEnd));
    audioService.send(node.id, 'message', { type: 'setStart', value: newLoopStart });
    persistRuntimeSettings({ loopStart: newLoopStart });
  }

  function updateLoopEnd(value: number) {
    const newLoopEnd = Math.max(loopStart, Math.min(value, recordingDuration));
    audioService.send(node.id, 'message', { type: 'setEnd', value: newLoopEnd });
    persistRuntimeSettings({ loopEnd: newLoopEnd });
  }

  function updateGain(value: number) {
    audioService.send(node.id, 'message', { type: 'setGain', value });
    persistRuntimeSettings({ gain: value });
  }

  function updatePlaybackRate(value: number) {
    audioService.send(node.id, 'message', { type: 'setPlaybackRate', value });
    persistRuntimeSettings({ playbackRate: value });
  }

  function updateDetune(value: number) {
    audioService.send(node.id, 'message', { type: 'setDetune', value });
    persistRuntimeSettings({ detune: value });
  }

  function updateNoteOffMode(value: 'one-shot' | 'held') {
    const oldValue = noteOffMode;
    audioService.send(node.id, 'message', { type: 'setNoteOffMode', value });
    persistRuntimeSettings({ noteOffMode: value });
    tracker.commit('noteOffMode', oldValue, value);
  }

  function persistRuntimeSettings(updates: Record<string, unknown>) {
    patchRuntime?.suppressNextAudioObjectSync(node.id);
    updateNodeData(node.id, updates);
  }

  function downloadBuffer(name?: string) {
    if (audioBuffer) downloadAsWav(audioBuffer, name);
  }

  function resetSettings() {
    const nextSettings = {
      ...node.data,
      loopStart: 0,
      loopEnd: recordingDuration,
      loop: false,
      gain: 1,
      playbackRate: 1,
      detune: 0,
      noteOffMode: 'one-shot'
    };

    tracker.commitMany('Reset sampler settings', [
      { dataKey: 'loopStart', oldValue: node.data.loopStart, newValue: nextSettings.loopStart },
      { dataKey: 'loopEnd', oldValue: node.data.loopEnd, newValue: nextSettings.loopEnd },
      { dataKey: 'loop', oldValue: node.data.loop, newValue: nextSettings.loop },
      { dataKey: 'gain', oldValue: node.data.gain, newValue: nextSettings.gain },
      {
        dataKey: 'playbackRate',
        oldValue: node.data.playbackRate,
        newValue: nextSettings.playbackRate
      },
      { dataKey: 'detune', oldValue: node.data.detune, newValue: nextSettings.detune },
      {
        dataKey: 'noteOffMode',
        oldValue: node.data.noteOffMode,
        newValue: nextSettings.noteOffMode
      }
    ]);

    // Update the live audio node before persisting its matching runtime settings.
    audioService.send(node.id, 'message', { type: 'setStart', value: 0 });
    audioService.send(node.id, 'message', { type: 'setEnd', value: recordingDuration });
    audioService.send(node.id, 'message', { type: 'loopOff' });
    audioService.send(node.id, 'message', { type: 'setGain', value: 1 });
    audioService.send(node.id, 'message', { type: 'setPlaybackRate', value: 1 });
    audioService.send(node.id, 'message', { type: 'setDetune', value: 0 });
    audioService.send(node.id, 'message', { type: 'setNoteOffMode', value: 'one-shot' });
    persistRuntimeSettings(nextSettings);
  }

  onMount(async () => {
    if (contentContainer) {
      resizeObserver = new ResizeObserver(updateContentWidth);
      resizeObserver.observe(contentContainer);
      updateContentWidth();
    }
  });

  let resizeObserver: ResizeObserver | undefined;

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (recordingInterval) clearInterval(recordingInterval);
    if (playbackInterval) clearInterval(playbackInterval);

    if (v2Node) {
      v2Node.onPlaybackStart = undefined;
      v2Node.onPlaybackStop = undefined;
      v2Node = null;
    }
  });

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  const containerClass = $derived.by(() => {
    if (vfsMedia.isDragging) return 'border-blue-400 bg-blue-50/10';
    if (node.data.loop && node.selected) return 'border-orange-300 bg-zinc-800 shadow-glow-md';
    if (node.selected) return 'object-container-selected';
    if (node.data.loop) return 'border-orange-400 bg-zinc-900 hover:shadow-glow-sm';
    return 'object-container';
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>

        <div class="flex gap-1">
          <!-- Record Button -->
          <button
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
            class="node-floating-button {isRecording ? '!opacity-100' : ''}"
            onclick={toggleRecording}
          >
            <!-- svelte-ignore svelte_component_deprecated -->
            <svelte:component
              this={isRecording ? Square : Circle}
              class="h-4 w-4 {isRecording ? 'text-red-500' : 'text-zinc-300'}"
            />
          </button>

          <!-- Play Button -->
          {#if hasRecording && !isRecording}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button class="node-floating-button" onclick={() => playRecording()}>
                  <Play class="h-4 w-4 text-zinc-300" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Play Recording</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <button
            class="node-floating-button"
            onclick={() => (showSettings = !showSettings)}
            title="Settings"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div class="relative">
        <!-- Audio Input Handle -->
        <TypedHandle
          port="inlet"
          spec={{ handleType: 'audio' }}
          total={2}
          index={0}
          title="Audio input"
          nodeId={node.id}
        />

        <!-- Message Input Handle -->
        <TypedHandle
          port="inlet"
          spec={{ handleType: 'message' }}
          total={2}
          index={1}
          title="Message input"
          nodeId={node.id}
        />

        {#if vfsMedia.needsFolderRelink || vfsMedia.needsReselect}
          <VfsRelinkOverlay
            needsReselect={vfsMedia.needsReselect}
            needsFolderRelink={vfsMedia.needsFolderRelink}
            linkedFolderName={vfsMedia.linkedFolderName}
            vfsPath={node.data.vfsPath}
            {width}
            {height}
            isDragging={vfsMedia.isDragging}
            onRequestPermission={vfsMedia.requestFilePermission}
            onDragOver={vfsMedia.handleDragOver}
            onDragLeave={vfsMedia.handleDragLeave}
            onDrop={vfsMedia.handleDrop}
          />
        {:else}
          <div
            class={[
              'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border-1',
              containerClass
            ]}
            ondragover={vfsMedia.handleDragOver}
            ondragleave={vfsMedia.handleDragLeave}
            ondrop={vfsMedia.handleDrop}
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
                <div class="font-mono text-[12px] text-zinc-400">
                  {#if vfsMedia.isDragging}
                    Drop audio file
                  {:else}
                    Record or drop file
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Audio Output Handle -->
        <TypedHandle
          port="outlet"
          spec={{ handleType: 'audio' }}
          total={1}
          index={0}
          title="Audio output"
          nodeId={node.id}
        />
      </div>
    </div>
  </div>

  {#if showSettings && hasRecording}
    <div class="absolute" style="left: {contentWidth + 10}px; top: 0; width: {contentWidth}px">
      <SamplerSettings
        {loopStart}
        {loopEnd}
        {recordingDuration}
        {loopEnabled}
        {gain}
        {playbackRate}
        {detune}
        {noteOffMode}
        onLoopStartChange={updateLoopStart}
        onLoopEndChange={updateLoopEnd}
        onGainChange={updateGain}
        onPlaybackRateChange={updatePlaybackRate}
        onDetuneChange={updateDetune}
        onNoteOffModeChange={updateNoteOffMode}
        onToggleLoop={toggleLoop}
        onReset={resetSettings}
        onClose={() => (showSettings = false)}
        {tracker}
        {loopStartTracker}
        {loopEndTracker}
        {gainTracker}
        {playbackRateTracker}
        {detuneTracker}
      />
    </div>
  {/if}
</div>

<!-- Hidden file input for file dialog -->
<input
  bind:this={vfsMedia.fileInputRef}
  type="file"
  accept="audio/*"
  onchange={vfsMedia.handleFileSelect}
  class="hidden"
/>
