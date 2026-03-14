<script lang="ts">
  import { Settings } from '@lucide/svelte/icons';
  import { onMount, onDestroy } from 'svelte';
  import { NodeResizer, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { VirtualFilesystem } from '$lib/vfs';
  import { padsMessages } from './schema';
  import PadCell from './PadCell.svelte';
  import PadsSettings from './PadsSettings.svelte';
  import type { PadsAudioNode as PadsAudioNodeType } from './PadsAudioNode';
  import {
    BASE_NOTE,
    GM_DRUM_NAMES,
    DEFAULT_PADS_NODE_DATA,
    PADS_MIN_WIDTH,
    PADS_MIN_HEIGHT,
    type PadsNodeData,
    type PadCount,
    type NoteOffMode
  } from './constants';

  let node: NodeProps & { data: PadsNodeData } = $props();

  const { updateNodeData } = useSvelteFlow();
  const audioService = AudioService.getInstance();

  let v2Node: PadsAudioNodeType | null = null;
  let messageContext: MessageContext;
  let showSettings = $state(false);
  let activeFlash = $state<Set<number>>(new Set());
  let containerEl: HTMLDivElement | null = null;

  // Derived from node data with fallbacks
  const pads = $derived(node.data.pads ?? DEFAULT_PADS_NODE_DATA.pads);
  const padCount = $derived(node.data.padCount ?? 16);
  const maxVoices = $derived(node.data.maxVoices ?? 4);
  const noteOffMode = $derived(node.data.noteOffMode ?? 'ignore');
  const showGmLabels = $derived(node.data.showGmLabels ?? true);
  const width = $derived(node.width ?? 280);
  const height = $derived(node.height ?? 300);

  // Flat pad indices in MPC order (pad 1 = bottom-left): top row = highest pads
  const orderedPads = $derived.by(() => {
    const rowCount = padCount / 4;
    const result: number[] = [];
    for (let r = 0; r < rowCount; r++) {
      const startIdx = (rowCount - 1 - r) * 4;
      for (let c = 0; c < 4; c++) result.push(startIdx + c);
    }
    return result;
  });

  // Sync runtime settings to audio node when they change
  $effect(() => {
    if (v2Node) {
      v2Node.maxVoices = maxVoices;
      v2Node.noteOffMode = noteOffMode;
      v2Node.padCount = padCount;
    }
  });

  function flashPad(padIndex: number) {
    activeFlash = new Set([...activeFlash, padIndex]);
    setTimeout(() => {
      activeFlash = new Set([...activeFlash].filter((i) => i !== padIndex));
    }, 150);
  }

  async function assignSample(padIndex: number, vfsPath: string) {
    const newPads = [...pads];
    newPads[padIndex] = { ...newPads[padIndex], vfsPath };
    updateNodeData(node.id, { ...node.data, pads: newPads });
    await loadPadBuffer(padIndex, vfsPath);
  }

  function clearPad(padIndex: number) {
    const newPads = [...pads];
    newPads[padIndex] = {};
    updateNodeData(node.id, { ...node.data, pads: newPads });
    v2Node?.clearBuffer(padIndex);
  }

  async function loadPadBuffer(padIndex: number, vfsPath: string) {
    try {
      const vfs = VirtualFilesystem.getInstance();
      const entry = vfs.getEntry(vfsPath);
      const sourceUrl = entry?.provider === 'url' ? entry.url : undefined;

      let arrayBuffer: ArrayBuffer;
      if (sourceUrl) {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        arrayBuffer = await response.arrayBuffer();
      } else {
        const fileOrBlob = await vfs.resolve(vfsPath);
        arrayBuffer = await fileOrBlob.arrayBuffer();
      }

      const buffer = await audioService.getAudioContext().decodeAudioData(arrayBuffer);
      v2Node?.setBuffer(padIndex, buffer);
    } catch (err) {
      console.error(`[pads~] pad ${padIndex} failed to load:`, err);
    }
  }

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(padsMessages.loadPad, ({ pad, src }) => {
        assignSample(pad, src);
      })
      .otherwise(() => audioService.send(node.id, 'message', message));
  };

  function updatePadCount(value: PadCount) {
    updateNodeData(node.id, { ...node.data, padCount: value });
  }

  function updateMaxVoices(value: number) {
    updateNodeData(node.id, { ...node.data, maxVoices: value });
  }

  function updateNoteOffMode(value: NoteOffMode) {
    updateNodeData(node.id, { ...node.data, noteOffMode: value });
  }

  function updateShowGmLabels(value: boolean) {
    updateNodeData(node.id, { ...node.data, showGmLabels: value });
  }

  function triggerPad(padIndex: number) {
    audioService.send(node.id, 'message', {
      type: 'noteOn',
      note: BASE_NOTE + padIndex,
      velocity: 100
    });
  }

  onMount(async () => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);

    audioService.createNode(node.id, 'pads~', []);
    v2Node = audioService.getNodeById(node.id) as PadsAudioNodeType;

    if (v2Node) {
      v2Node.maxVoices = maxVoices;
      v2Node.noteOffMode = noteOffMode;
      v2Node.padCount = padCount;
      v2Node.onTrigger = flashPad;
    }

    // Load all pads that have a saved vfsPath
    for (let i = 0; i < pads.length; i++) {
      if (pads[i].vfsPath) {
        loadPadBuffer(i, pads[i].vfsPath!);
      }
    }
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    audioService.removeNodeById(node.id);
  });
</script>

<NodeResizer
  minWidth={PADS_MIN_WIDTH}
  minHeight={PADS_MIN_HEIGHT}
  isVisible={node.selected}
  keepAspectRatio
/>

<div class="group relative" bind:this={containerEl}>
  <!-- Floating settings button — visible on hover, like SamplerNode -->
  <div class="absolute -top-7 right-0 flex gap-1">
    <button
      class="cursor-pointer rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
      onclick={() => (showSettings = !showSettings)}
      title="Settings"
    >
      <Settings class="h-4 w-4 text-zinc-300" />
    </button>
  </div>

  <!-- Handles sit on the outer relative wrapper (no overflow-hidden here) -->
  <div class="relative" style="width:{width}px; height:{height}px">
    <StandardHandle
      port="inlet"
      type="message"
      title="MIDI input (noteOn/noteOff)"
      nodeId={node.id}
    />
    <StandardHandle port="outlet" type="audio" title="Audio output" nodeId={node.id} />

    <!-- Content box — overflow-hidden stays here, handles are outside it -->
    <div class="absolute inset-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
      <!-- Pad grid: CSS grid guarantees perfectly equal cell sizes -->
      <div
        class="grid h-full gap-1.5 p-1.5"
        style="grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat({padCount /
          4}, 1fr)"
      >
        {#each orderedPads as padIndex (padIndex)}
          <PadCell
            {padIndex}
            padConfig={pads[padIndex] ?? {}}
            gmName={GM_DRUM_NAMES[BASE_NOTE + padIndex] ?? `Pad ${padIndex + 1}`}
            isActive={activeFlash.has(padIndex)}
            {showGmLabels}
            onAssign={assignSample}
            onClear={clearPad}
            onTrigger={triggerPad}
          />
        {/each}
      </div>
    </div>
  </div>
</div>

<!-- Settings panel — appears to the right of the node -->
{#if showSettings}
  <div class="absolute" style="left: {width + 10}px; top: 0;">
    <PadsSettings
      nodeId={node.id}
      {padCount}
      {maxVoices}
      {noteOffMode}
      {showGmLabels}
      onPadCountChange={updatePadCount}
      onMaxVoicesChange={updateMaxVoices}
      onNoteOffModeChange={updateNoteOffMode}
      onShowGmLabelsChange={updateShowGmLabels}
      onClose={() => (showSettings = false)}
    />
  </div>
{/if}
