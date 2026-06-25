<script lang="ts">
  import { Pause, Play, Settings, Square, Upload, X } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onDestroy, onMount } from 'svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useNodeDataTracker } from '$lib/history';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { isMidiFileMessageType, isMidiFilePlayMessage } from '../midi-file-command';
  import { parseMidiFileLoadInput, type MidiFileLoadInput } from '../midi-file-load-input';
  import { parseMidiFile } from '../midi-file-parser';
  import { MidiFilePlayer, type ParsedMidiFile } from '../midi-file-player';
  import { midiFileSchema } from '../schema';
  import { Transport } from '$lib/transport';
  import { VirtualFilesystem } from '$lib/vfs';
  import { transportStore, type TransportPlayState } from '../../../stores/transport.store';

  type MidiFileNodeData = {
    fileName?: string;
    vfsPath?: string;
    fileData?: string;
    durationSeconds?: number;
    durationTicks?: number;
    ppq?: number;
    trackCount?: number;
    playState?: 'stopped' | 'playing' | 'paused';
    positionSeconds?: number;
    loop?: boolean;
    applyTempoToTransport?: boolean;
    applyTimeSignatureToTransport?: boolean;
    syncTransport?: boolean;
    outputMetaEvents?: boolean;
  };

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: MidiFileNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = useNodeDataTracker(nodeId);
  const vfs = VirtualFilesystem.getInstance();

  let messageContext: MessageContext;
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let showSettings = $state(false);
  let errorMessage = $state<string | null>(null);
  let parsedFile = $state<ParsedMidiFile | null>(null);
  let positionSeconds = $state(data.positionSeconds ?? 0);
  let playState = $state<'stopped' | 'playing' | 'paused'>(data.playState ?? 'stopped');
  let isDragging = $state(false);
  let positionTimer: ReturnType<typeof setInterval> | null = null;
  let lastTransportState: TransportPlayState | null = null;
  let unsubscribeTransport: (() => void) | null = null;

  const player = new MidiFilePlayer({
    send: (message) => messageContext?.send(message),
    outputMetaEvents: () => data.outputMetaEvents === true,
    loop: () => data.loop === true
  });

  const hasFile = $derived(parsedFile !== null);
  const displayName = $derived(data.fileName ?? 'No file loaded');
  const durationSeconds = $derived(parsedFile?.durationSeconds ?? 0);
  const firstTempo = $derived(parsedFile?.tempos[0]?.bpm);
  const firstTimeSignature = $derived(parsedFile?.timeSignatures[0]);
  const borderColor = $derived.by(() => {
    if (errorMessage) return 'border-red-500';
    if (!hasFile) return 'border-amber-500';
    if (selected) return 'border-zinc-400';
    return 'border-zinc-600';
  });

  const handleMessage: MessageCallbackFn = async (message) => {
    const loadInput = parseMidiFileLoadInput(message);
    if (loadInput) {
      await loadParsedInput(loadInput);
      return;
    }

    if (isMidiFilePlayMessage(message)) {
      play();
      return;
    }

    if (message === 'pause' || isMidiFileMessageType(message, 'pause')) {
      pause();
      return;
    }

    if (message === 'stop' || isMidiFileMessageType(message, 'stop')) {
      stop();
      return;
    }

    if (isMidiFileMessageType(message, 'seek')) {
      const seconds = typeof message.seconds === 'number' ? message.seconds : undefined;
      const ticks = typeof message.ticks === 'number' ? message.ticks : undefined;
      const beats = typeof message.beats === 'number' ? message.beats : undefined;

      if (seconds !== undefined) seek(seconds);
      else if (ticks !== undefined && parsedFile) seek(ticksToSeconds(ticks, parsedFile));
      else if (beats !== undefined && parsedFile)
        seek(ticksToSeconds(beats * parsedFile.ppq, parsedFile));
      return;
    }

    if (isMidiFileMessageType(message, 'loop')) {
      const next = typeof message.value === 'boolean' ? message.value : !data.loop;
      updateTracked('loop', next);
      return;
    }

    if (isMidiFileMessageType(message, 'set')) {
      for (const key of [
        'applyTempoToTransport',
        'applyTimeSignatureToTransport',
        'syncTransport',
        'outputMetaEvents',
        'loop'
      ] as const) {
        if (typeof message[key] === 'boolean') updateTracked(key, message[key]);
      }
      return;
    }
  };

  async function loadParsedInput(input: MidiFileLoadInput): Promise<void> {
    if (input.type === 'vfsPath') await loadFromVfsPath(input.vfsPath);
    else if (input.type === 'url') await loadFromUrl(input.url);
    else await loadInlineBytes(input.fileName, input.bytes);
  }

  async function loadFile(file: File): Promise<void> {
    const vfsPath = await vfs.storeFile(file);
    updateNodeData(nodeId, { ...data, vfsPath, fileName: file.name, fileData: undefined });
    await loadFromFile(file, { vfsPath });
  }

  async function loadFromVfsPath(vfsPath: string): Promise<void> {
    updateNodeData(nodeId, { ...data, vfsPath, fileData: undefined });
    const fileOrBlob = await vfs.resolve(vfsPath);
    const file =
      fileOrBlob instanceof File
        ? fileOrBlob
        : new File([fileOrBlob], vfsPath.split('/').pop() ?? 'midi file', {
            type: fileOrBlob.type
          });
    await loadFromFile(file, { vfsPath });
  }

  async function loadFromUrl(url: string): Promise<void> {
    const vfsPath = await vfs.registerUrl(url);
    await loadFromVfsPath(vfsPath);
  }

  async function loadInlineBase64(fileName: string, base64: string): Promise<void> {
    const bytes = base64ToBytes(base64);
    await loadInlineBytes(fileName, bytes);
  }

  async function loadInlineBytes(fileName: string, bytes: Uint8Array): Promise<void> {
    const parsed = parseMidiFile(bytes, fileName);
    setParsedFile(parsed);
    updateNodeData(nodeId, {
      ...data,
      fileName,
      fileData: bytesToBase64(bytes),
      vfsPath: undefined,
      ...metadataForNode(parsed)
    });
  }

  async function loadFromFile(file: File, source: { vfsPath?: string } = {}): Promise<void> {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseMidiFile(bytes, file.name);
      setParsedFile(parsed);
      updateNodeData(nodeId, {
        ...data,
        fileName: file.name,
        ...source,
        fileData: source.vfsPath ? undefined : bytesToBase64(bytes),
        ...metadataForNode(parsed)
      });
    } catch (error) {
      handleError(error);
    }
  }

  function setParsedFile(file: ParsedMidiFile): void {
    parsedFile = file;
    player.load(file);
    errorMessage = null;
    positionSeconds = 0;
    playState = 'stopped';
  }

  function play(): void {
    if (!parsedFile) return;
    applyTransportMetadata();
    player.play();
    syncStateFromPlayer();
    startPositionTimer();
  }

  function pause(): void {
    player.pause();
    syncStateFromPlayer();
    stopPositionTimer();
  }

  function stop(): void {
    player.stop();
    syncStateFromPlayer();
    stopPositionTimer();
  }

  function seek(seconds: number): void {
    player.seek(seconds);
    syncStateFromPlayer();
  }

  function handleSeekInput(event: Event): void {
    seek(Number((event.target as HTMLInputElement).value));
  }

  function applyTransportMetadata(): void {
    if (!parsedFile || positionSeconds !== 0) return;

    if (data.applyTempoToTransport !== false) {
      const tempo = parsedFile.tempos[0];
      if (tempo) Transport.setBpm(Math.round(tempo.bpm * 100) / 100);
    }

    if (data.applyTimeSignatureToTransport !== false) {
      const timeSignature = parsedFile.timeSignatures[0];
      if (timeSignature) {
        Transport.setTimeSignature(timeSignature.numerator, timeSignature.denominator);
      }
    }
  }

  function syncStateFromPlayer(): void {
    positionSeconds = player.positionSeconds;
    playState = player.playState;
    updateNodeData(nodeId, {
      ...data,
      positionSeconds,
      playState
    });
  }

  function startPositionTimer(): void {
    stopPositionTimer();
    positionTimer = setInterval(() => {
      positionSeconds = player.positionSeconds;
      playState = player.playState;
      if (playState !== 'playing') stopPositionTimer();
    }, 100);
  }

  function stopPositionTimer(): void {
    if (positionTimer) clearInterval(positionTimer);
    positionTimer = null;
  }

  function updateTracked<K extends keyof MidiFileNodeData>(
    key: K,
    value: MidiFileNodeData[K]
  ): void {
    const oldValue = data[key];
    updateNodeData(nodeId, { ...data, [key]: value });
    tracker.commit(String(key), oldValue, value);
  }

  function settingChecked(key: keyof MidiFileNodeData): boolean {
    if (key === 'loop' || key === 'syncTransport' || key === 'outputMetaEvents') {
      return data[key] === true;
    }

    return data[key] !== false;
  }

  function openFileDialog(): void {
    fileInputRef?.click();
  }

  async function handleFileSelect(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await loadFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(): void {
    isDragging = false;
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    isDragging = false;

    const vfsPath = event.dataTransfer?.getData('application/x-vfs-path');
    if (vfsPath) {
      await loadFromVfsPath(vfsPath);
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    if (file) await loadFile(file);
  }

  function handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage = message;
    messageContext?.send({ type: 'error', message });
  }

  function formatSeconds(seconds: number | undefined): string {
    if (!Number.isFinite(seconds)) return '0:00';
    const safeSeconds = Math.max(0, Math.floor(seconds ?? 0));
    const minutes = Math.floor(safeSeconds / 60);
    return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
  }

  function metadataForNode(file: ParsedMidiFile): Partial<MidiFileNodeData> {
    return {
      durationSeconds: file.durationSeconds,
      durationTicks: file.durationTicks,
      ppq: file.ppq,
      trackCount: file.trackCount,
      positionSeconds: 0,
      playState: 'stopped'
    };
  }

  function ticksToSeconds(ticks: number, file: ParsedMidiFile): number {
    const event = file.events.find((event) => event.ticks >= ticks);
    return event?.seconds ?? file.durationSeconds;
  }

  function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToBytes(value: string): Uint8Array {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    unsubscribeTransport = transportStore.subscribe(({ playState: nextPlayState }) => {
      if (!data.syncTransport || lastTransportState === nextPlayState) {
        lastTransportState = nextPlayState;
        return;
      }

      lastTransportState = nextPlayState;
      if (nextPlayState === 'playing') play();
      else if (nextPlayState === 'paused') pause();
      else stop();
    });

    try {
      if (data.vfsPath) await loadFromVfsPath(data.vfsPath);
      else if (data.fileData) await loadInlineBase64(data.fileName ?? 'midi file', data.fileData);
    } catch (error) {
      handleError(error);
    }
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    unsubscribeTransport?.();
    stopPositionTimer();
    player.destroy();
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="node-title-drag-handle z-10 rounded-lg bg-zinc-900 px-2 py-1">
          <div class="font-mono text-xs font-medium text-zinc-400">midi.file</div>
        </div>

        <div class="flex gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="node-floating-button cursor-pointer"
                onclick={() => (showSettings = !showSettings)}
              >
                <Settings class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Settings</Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>

      <div class="relative">
        <TypedHandle
          port="inlet"
          spec={midiFileSchema.inlets[0].handle!}
          total={1}
          index={0}
          {nodeId}
        />

        <div class="nodrag">
          {#if hasFile}
            <div
              class={[
                'flex w-[260px] flex-col gap-3 rounded-xl border bg-zinc-900/95 px-4 py-3 text-zinc-300 shadow-xl',
                borderColor,
                isDragging ? 'bg-blue-950/30' : '',
                selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
              ]}
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
              role="group"
              aria-label="MIDI file player"
            >
              <div class="min-w-0">
                <div class="truncate font-mono text-sm font-medium text-zinc-200">
                  {displayName}
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="w-9 shrink-0 font-mono text-[11px] text-zinc-500">
                  {formatSeconds(positionSeconds)}
                </div>
                <input
                  class="midi-seek min-w-0 flex-1 cursor-pointer"
                  type="range"
                  min="0"
                  max={durationSeconds}
                  step="0.01"
                  value={positionSeconds}
                  aria-label="Seek MIDI file"
                  oninput={handleSeekInput}
                />
                <div class="w-9 shrink-0 text-right font-mono text-[11px] text-zinc-500">
                  {formatSeconds(durationSeconds)}
                </div>
              </div>

              <div class="flex items-center justify-center gap-4 pt-1">
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class={[
                        'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                        playState === 'stopped' ? 'opacity-60' : ''
                      ]}
                      onclick={stop}
                    >
                      <Square class="h-4 w-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Stop</Tooltip.Content>
                </Tooltip.Root>

                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class={[
                        'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-zinc-100 text-zinc-950 shadow-md shadow-black/30 hover:bg-zinc-200',
                        playState === 'playing' ? 'bg-zinc-300 text-zinc-950' : ''
                      ]}
                      onclick={() => (playState === 'playing' ? pause() : play())}
                    >
                      {#if playState === 'playing'}
                        <Pause class="h-6 w-6" />
                      {:else}
                        <Play class="ml-0.5 h-6 w-6" />
                      {/if}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{playState === 'playing' ? 'Pause' : 'Play'}</Tooltip.Content>
                </Tooltip.Root>
              </div>
            </div>
          {:else}
            <button
              class={[
                'flex w-full cursor-pointer flex-col items-center justify-center rounded-md border bg-zinc-900 px-3 py-2 text-zinc-300 hover:bg-zinc-800',
                borderColor,
                isDragging ? 'bg-blue-950/30' : '',
                selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
              ]}
              onclick={openFileDialog}
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
            >
              <Upload class="mb-1 h-4 w-4" />

              <div class="text-[10px]">
                <span class="text-amber-400">Load MIDI</span>
              </div>
            </button>
          {/if}

          {#if errorMessage}
            <div class="mt-2 rounded border border-red-700 bg-red-900/20 p-2 text-xs text-red-400">
              {errorMessage}
            </div>
          {/if}
        </div>

        <TypedHandle
          port="outlet"
          spec={midiFileSchema.outlets[0].handle!}
          total={1}
          index={0}
          {nodeId}
        />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="relative">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="cursor-pointer rounded p-1 hover:bg-zinc-700"
        >
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="nodrag w-72 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-4">
          <button
            class="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700"
            onclick={openFileDialog}
          >
            <Upload class="h-4 w-4" />
            {hasFile ? 'Replace MIDI File' : 'Load MIDI File'}
          </button>

          <div class="space-y-2">
            {#each [['applyTempoToTransport', 'Apply tempo to transport'], ['applyTimeSignatureToTransport', 'Apply time signature'], ['syncTransport', 'Sync to transport'], ['outputMetaEvents', 'Emit meta events'], ['loop', 'Loop']] as [key, label]}
              <label class="flex items-center gap-2 text-xs text-zinc-300">
                <input
                  class="h-3 w-3 cursor-pointer"
                  type="checkbox"
                  checked={settingChecked(key as keyof MidiFileNodeData)}
                  onchange={(event) =>
                    updateTracked(
                      key as keyof MidiFileNodeData,
                      (event.target as HTMLInputElement).checked as never
                    )}
                />
                {label}
              </label>
            {/each}
          </div>

          <div class="space-y-1 border-t border-zinc-700 pt-3 font-mono text-[10px] text-zinc-500">
            <div>source: {data.vfsPath ? 'VFS' : data.fileData ? 'inline' : 'none'}</div>
            {#if data.vfsPath}<div class="truncate">{data.vfsPath}</div>{/if}
            <div>tracks: {parsedFile?.trackCount ?? '-'}</div>
            <div>ppq: {parsedFile?.ppq ?? '-'}</div>
            <div>duration: {formatSeconds(parsedFile?.durationSeconds)}</div>
            <div>tempo: {firstTempo ? `${Math.round(firstTempo * 100) / 100} bpm` : '-'}</div>
            <div>
              signature:
              {firstTimeSignature
                ? `${firstTimeSignature.numerator}/${firstTimeSignature.denominator}`
                : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<input
  bind:this={fileInputRef}
  type="file"
  accept=".mid,.midi,audio/midi,audio/x-midi,application/x-midi"
  onchange={handleFileSelect}
  class="hidden"
/>

<style>
  .midi-seek {
    appearance: none;
    height: 18px;
    background: transparent;
  }

  .midi-seek::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: rgb(82 82 91);
  }

  .midi-seek::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    margin-top: -7px;
    border-radius: 999px;
    border: 2px solid rgb(244 244 245);
    background: rgb(113 113 122);
  }

  .midi-seek:focus-visible {
    outline: 2px solid rgb(16 185 129);
    outline-offset: 4px;
    border-radius: 999px;
  }

  .midi-seek::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: rgb(82 82 91);
  }

  .midi-seek::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 2px solid rgb(244 244 245);
    background: rgb(113 113 122);
  }
</style>
