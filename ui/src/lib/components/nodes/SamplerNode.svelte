<script lang="ts">
  import { Circle, CloudDownload, Mic, Play, Settings, Square } from '@lucide/svelte/icons';
  import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import WaveformDisplay from '$lib/components/nodes/WaveformDisplay.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { samplerMessages } from '$lib/objects/schemas';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { downloadAsWav } from '$lib/audio/wav-encoder';
  import type { SamplerNode as SamplerNodeV2 } from '$lib/audio/v2/nodes/SamplerNode';
  import { useVfsMedia } from '$lib/vfs';
  import { VfsRelinkOverlay } from '$lib/vfs/components';
  import { useNodeDataTracker } from '$lib/history';
  import SamplerSettings from '$lib/components/settings/SamplerSettings.svelte';

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

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(node.id);
  const loopStartTracker = tracker.track('loopStart', () => node.data.loopStart ?? 0);
  const loopEndTracker = tracker.track('loopEnd', () => node.data.loopEnd ?? recordingDuration);
  const playbackRateTracker = tracker.track('playbackRate', () => node.data.playbackRate ?? 1);
  const detuneTracker = tracker.track('detune', () => node.data.detune ?? 0);

  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(10);
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

  // Use VFS media composable for file handling (drag/drop, persistence, relink)
  const vfsMedia = useVfsMedia({
    nodeId: node.id,
    acceptMimePrefix: 'audio/',
    onFileLoaded: handleFileLoaded,
    updateNodeData: (data) => updateNodeData(node.id, { ...node.data, ...data }),
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
    // Send to audio node first
    audioService.send(node.id, 'message', samples);

    // Create AudioBuffer for UI waveform display
    const sampleRate = audioService.getAudioContext().sampleRate;
    const buffer = audioService.getAudioContext().createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(new Float32Array(samples), 0);

    // Update UI state
    audioBuffer = buffer;
    const duration = buffer.duration;

    updateNodeData(node.id, {
      ...node.data,
      hasRecording: true,
      duration: duration,
      loopStart: 0,
      loopEnd: duration
    });

    // Update AudioService's loop end point
    audioService.send(node.id, 'message', { type: 'setEnd', value: duration });
  }

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
    // Handle Float32Array directly - update UI state
    if (message instanceof Float32Array) {
      handleFloat32ArrayInput(message);
      return;
    }

    match(message)
      .with(samplerMessages.record, () => startRecording())
      .with(samplerMessages.end, () => stopRecording())
      .with(samplerMessages.bang, () => playRecording())
      .with(samplerMessages.play, () => playRecording())
      .with(samplerMessages.stop, () => stopPlayback())
      .with(samplerMessages.loopWithOptionalPoints, (msg) => {
        updateNodeData(node.id, {
          ...node.data,
          ...(msg.start !== undefined ? { loopStart: msg.start } : {}),
          ...(msg.end !== undefined ? { loopEnd: msg.end } : {})
        });

        toggleLoop();
      })
      .with(samplerMessages.loopOnWithOptionalPoints, (msg) => {
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
      .with(samplerMessages.loopOff, () => {
        updateNodeData(node.id, { ...node.data, loop: false });
        audioService.send(node.id, 'message', { type: 'loopOff' });
      })
      .with(samplerMessages.setStart, (msg) => {
        updateNodeData(node.id, { ...node.data, loopStart: msg.value });
        audioService.send(node.id, 'message', { type: 'setStart', value: msg.value });
      })
      .with(samplerMessages.setEnd, (msg) => {
        updateNodeData(node.id, { ...node.data, loopEnd: msg.value });
        audioService.send(node.id, 'message', { type: 'setEnd', value: msg.value });
      })
      .with(samplerMessages.setPlaybackRate, (msg) => {
        updateNodeData(node.id, { ...node.data, playbackRate: msg.value });
        audioService.send(node.id, 'message', { type: 'setPlaybackRate', value: msg.value });
      })
      .with(samplerMessages.setDetune, (msg) => {
        updateNodeData(node.id, { ...node.data, detune: msg.value });
        audioService.send(node.id, 'message', { type: 'setDetune', value: msg.value });
      })
      .with(samplerMessages.download, (msg) => downloadBuffer(msg.name))
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

  function downloadBuffer(name?: string) {
    if (audioBuffer) downloadAsWav(audioBuffer, name);
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
    }

    // Load audio from VFS path (handles permissions, relink, etc.)
    if (node.data.vfsPath) {
      await vfsMedia.loadFromVfsPath(node.data.vfsPath);
    }

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
            class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0 {isRecording
              ? '!opacity-100'
              : ''}"
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
            <button
              title="Play Recording"
              class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={playRecording}
            >
              <Play class="h-4 w-4 text-zinc-300" />
            </button>
          {/if}

          <button
            class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
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
    <div class="absolute" style="left: {contentWidth + 10}px; top: 0; width: {contentWidth}px">
      <SamplerSettings
        {loopStart}
        {loopEnd}
        {recordingDuration}
        {loopEnabled}
        {playbackRate}
        {detune}
        onLoopStartChange={updateLoopStart}
        onLoopEndChange={updateLoopEnd}
        onPlaybackRateChange={updatePlaybackRate}
        onDetuneChange={updateDetune}
        onToggleLoop={toggleLoop}
        onReset={resetSettings}
        onClose={() => (showSettings = false)}
        {tracker}
        {loopStartTracker}
        {loopEndTracker}
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
