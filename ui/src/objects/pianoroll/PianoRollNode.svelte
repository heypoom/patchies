<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { match } from 'ts-pattern';
  import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import { NodeResizer } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { PianoRollObject } from './PianoRollObject';
  import PianoRollKeys from './PianoRollKeys.svelte';
  import PianoRollGrid from './PianoRollGrid.svelte';
  import { pianoRollMessages, pianoRollHandles } from './schema';
  import {
    DEFAULT_PIANOROLL_DATA,
    PIANOROLL_MIN_WIDTH,
    PIANOROLL_MIN_HEIGHT,
    RULER_HEIGHT,
    NOTE_HEIGHT,
    type PianoRollNodeData,
    type PianoRollMode,
    type PianoRollNote
  } from './types';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Repeat, Trash2, Settings } from '@lucide/svelte/icons';

  let { id: nodeId, data, selected }: NodeProps & { data: PianoRollNodeData } = $props();

  const { updateNodeData } = useSvelteFlow();

  let messageContext: MessageContext | null = null;
  let pianoRollObj: PianoRollObject | null = null;
  let pollingId: ReturnType<typeof setInterval> | null = null;
  let showSettings = $state(false);

  // Derived from node data with defaults
  const notes = $derived((data.notes ?? []) as PianoRollNote[]);
  const mode = $derived((data.mode ?? 'idle') as PianoRollMode);
  const lengthBars = $derived(data.lengthBars ?? DEFAULT_PIANOROLL_DATA.lengthBars);
  const loop = $derived(data.loop ?? DEFAULT_PIANOROLL_DATA.loop);
  const syncToTr = $derived(data.syncToTransport ?? DEFAULT_PIANOROLL_DATA.syncToTransport);
  const quantize = $derived(data.quantize ?? DEFAULT_PIANOROLL_DATA.quantize);
  const scrollNote = $derived(data.scrollNote ?? DEFAULT_PIANOROLL_DATA.scrollNote);
  const zoom = $derived(data.zoom ?? DEFAULT_PIANOROLL_DATA.zoom);

  let pianoRollAreaHeight = $state(0);

  // Compute visible notes from actual rendered height of the piano roll area
  const visibleNotes = $derived(
    Math.max(Math.floor((pianoRollAreaHeight - RULER_HEIGHT) / NOTE_HEIGHT), 1)
  );

  function setData<K extends keyof PianoRollNodeData>(key: K, value: PianoRollNodeData[K]) {
    updateNodeData(nodeId, { [key]: value });
  }

  function handleInletMidi(raw: unknown) {
    match(raw)
      .with(pianoRollMessages.noteOn, (msg) => {
        pianoRollObj?.incomingNote(msg);
        if (
          mode === 'recording' &&
          (msg.note < scrollNote || msg.note >= scrollNote + visibleNotes)
        ) {
          setData(
            'scrollNote',
            Math.max(0, Math.min(127 - visibleNotes, msg.note - Math.floor(visibleNotes / 2)))
          );
        }
      })
      .with(pianoRollMessages.noteOff, (msg) => pianoRollObj?.incomingNote(msg))
      .otherwise(() => {});
  }

  function handleInletCommand(raw: unknown) {
    match(raw)
      .with(pianoRollMessages.arm, () => pianoRollObj?.arm())
      .with(pianoRollMessages.record, () => pianoRollObj?.record())
      .with(pianoRollMessages.stop, () => pianoRollObj?.stop())
      .with(pianoRollMessages.clear, () => {
        pianoRollObj?.clear();
        setData('notes', []);
      })
      .with(pianoRollMessages.loop, () => {
        setData('loop', true);
        pianoRollObj?.toggleLoop();
      })
      .with(pianoRollMessages.unloop, () => {
        setData('loop', false);
        pianoRollObj?.toggleLoop();
      })
      .otherwise(() => {});
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);

    pianoRollObj = new PianoRollObject(nodeId, {
      getNotes: () => notes,
      getLengthBars: () => lengthBars,
      getQuantize: () => quantize,
      getLoop: () => loop,
      getSyncToTransport: () => syncToTr,
      onNoteCommit: (note) => {
        updateNodeData(nodeId, { notes: [...notes, note] });
      },
      onRecordEnd: (_clipLengthTicks) => {
        // lengthBars already correct from settings; nothing extra to persist
      },
      onModeChange: (m) => {
        updateNodeData(nodeId, { mode: m });
      },
      onSend: (msg) => {
        messageContext?.send(msg);
      }
    });

    pianoRollObj.create();

    // Route based on inlet index from meta
    messageContext.messageCallbacks = [
      (data, meta) => {
        const inlet = (meta as { inlet?: number })?.inlet ?? 0;
        if (inlet === 0) {
          handleInletMidi(data);
        } else if (inlet === 1) {
          handleInletCommand(data);
        }
      }
    ];

    pollingId = setInterval(() => pianoRollObj?.tick(), 50);
  });

  onDestroy(() => {
    if (pollingId) clearInterval(pollingId);
    pianoRollObj?.destroy();
    messageContext?.destroy();
  });

  function handleNoteAdd(note: PianoRollNote) {
    updateNodeData(nodeId, { notes: [...notes, note] });
    // Preview: send noteOn immediately
    messageContext?.send({
      type: 'noteOn',
      note: note.note,
      velocity: note.velocity,
      channel: note.channel
    });
    setTimeout(() => {
      messageContext?.send({
        type: 'noteOff',
        note: note.note,
        velocity: 0,
        channel: note.channel
      });
    }, 200);
  }

  function handleNoteDelete(index: number) {
    const newNotes = notes.filter((_, i) => i !== index);

    updateNodeData(nodeId, { notes: newNotes });
  }

  function handleNoteUpdate(index: number, patch: Partial<PianoRollNote>) {
    updateNodeData(nodeId, { notes: notes.map((n, i) => (i === index ? { ...n, ...patch } : n)) });
  }

  function handleScroll(delta: number) {
    const newScroll = Math.max(0, Math.min(115, scrollNote + delta));
    updateNodeData(nodeId, { scrollNote: newScroll });
  }

  function handlePreviewNote(note: number) {
    messageContext?.send({ type: 'noteOn', note, velocity: 100, channel: 1 });
    setTimeout(() => {
      messageContext?.send({ type: 'noteOff', note, velocity: 0, channel: 1 });
    }, 200);
  }

  const modeLabel = $derived(
    match(mode)
      .with('idle', () => 'IDLE')
      .with('armed', () => 'ARMED')
      .with('recording', () => 'REC')
      .with('playing', () => 'PLAYING')
      .with('looping', () => 'LOOPING')
      .exhaustive()
  );

  const modeBadgeClass = $derived(
    match(mode)
      .with('idle', () => 'bg-zinc-800 text-zinc-500')
      .with('armed', () => 'bg-amber-900/60 text-amber-300 ring-1 ring-amber-700/70')
      .with('recording', () => 'bg-red-900/60 text-red-300 ring-1 ring-red-700/70 animate-pulse')
      .with('playing', () => 'bg-green-900/60 text-green-300 ring-1 ring-green-700/70')
      .with('looping', () => 'bg-blue-900/60 text-blue-300 ring-1 ring-blue-700/70')
      .exhaustive()
  );

  const containerBorderClass = $derived(
    match(mode)
      .with('recording', () => 'border-red-900/70')
      .with('armed', () => 'border-amber-900/70')
      .otherwise(() => 'border-zinc-800')
  );
</script>

<NodeResizer isVisible={selected} minWidth={PIANOROLL_MIN_WIDTH} minHeight={PIANOROLL_MIN_HEIGHT} />

<div
  class="flex h-full w-full flex-col overflow-hidden rounded border bg-zinc-950 text-xs transition-colors duration-300 {containerBorderClass}"
>
  <!-- Header -->
  <div
    class="nodrag flex flex-shrink-0 items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/40 px-2 py-1"
  >
    <span class="font-mono text-[10px] font-semibold tracking-widest text-zinc-400 uppercase"
      >pianoroll</span
    >

    <!-- Mode badge -->
    <span class="rounded-full px-1.5 py-0.5 text-[9px] font-bold {modeBadgeClass}">{modeLabel}</span
    >

    {#if notes.length > 0}
      <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">{notes.length}</span>
    {/if}

    <div class="flex-1"></div>

    <!-- ARM button -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide ring-1 transition-colors
            {mode === 'armed' || mode === 'recording'
            ? 'bg-red-900/60 text-red-300 ring-red-700/70 hover:bg-red-900/80'
            : 'bg-zinc-800 text-zinc-400 ring-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'}"
          onclick={() =>
            mode === 'recording' || mode === 'armed' ? pianoRollObj?.stop() : pianoRollObj?.arm()}
        >
          {mode === 'armed' || mode === 'recording' ? '■ STOP' : '● ARM'}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content
        >{mode === 'recording' ? 'Stop recording' : 'Arm for recording'}</Tooltip.Content
      >
    </Tooltip.Root>

    <!-- LOOP toggle -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded p-1 {loop
            ? 'text-blue-400'
            : 'text-zinc-500 hover:text-zinc-300'}"
          onclick={() => setData('loop', !loop)}
        >
          <Repeat class="h-3 w-3" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Loop {loop ? 'on' : 'off'}</Tooltip.Content>
    </Tooltip.Root>

    <!-- CLEAR -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded p-1 text-zinc-500 hover:text-red-400"
          onclick={() => {
            pianoRollObj?.clear();
            setData('notes', []);
          }}
        >
          <Trash2 class="h-3 w-3" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Clear all notes</Tooltip.Content>
    </Tooltip.Root>

    <!-- Settings -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded p-1 text-zinc-500 hover:text-zinc-300"
          onclick={() => (showSettings = !showSettings)}
        >
          <Settings class="h-3 w-3" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Settings</Tooltip.Content>
    </Tooltip.Root>
  </div>

  <!-- Settings panel -->
  {#if showSettings}
    <div
      class="nodrag flex flex-shrink-0 flex-col gap-1 border-b border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-300"
    >
      <div class="flex items-center gap-2">
        <span class="w-20">Bars</span>
        <select
          class="cursor-pointer rounded border border-zinc-600 bg-zinc-700 px-1 py-0.5"
          value={lengthBars}
          onchange={(e) => setData('lengthBars', Number(e.currentTarget.value))}
        >
          {#each [1, 2, 4, 8, 16] as n (n)}
            <option value={n}>{n}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-20">Quantize</span>
        <select
          class="cursor-pointer rounded border border-zinc-600 bg-zinc-700 px-1 py-0.5"
          value={quantize}
          onchange={(e) =>
            setData('quantize', e.currentTarget.value as PianoRollNodeData['quantize'])}
        >
          {#each ['off', '1/32', '1/16', '1/8', '1/4', '1/2'] as q (q)}
            <option value={q}>{q}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-20">Sync transport</span>
        <input
          type="checkbox"
          checked={syncToTr}
          onchange={(e) => setData('syncToTransport', e.currentTarget.checked)}
          class="cursor-pointer"
        />
      </div>
    </div>
  {/if}

  <!-- Piano roll -->
  <div class="flex flex-1 overflow-hidden" bind:clientHeight={pianoRollAreaHeight}>
    <!-- Piano keys canvas (includes ruler spacer) -->
    <div class="nodrag nopan">
      <PianoRollKeys {scrollNote} {visibleNotes} onPreviewNote={handlePreviewNote} />
    </div>

    <!-- Scrollable grid -->
    <div class="nodrag nopan nowheel flex-1 overflow-x-auto overflow-y-hidden">
      <PianoRollGrid
        {notes}
        {scrollNote}
        {visibleNotes}
        {zoom}
        {lengthBars}
        {quantize}
        {mode}
        onNoteAdd={handleNoteAdd}
        onNoteDelete={handleNoteDelete}
        onNoteUpdate={handleNoteUpdate}
        onScroll={handleScroll}
      />
    </div>
  </div>

  <!-- Handles -->
  <TypedHandle
    port="inlet"
    spec={pianoRollHandles.midiIn}
    title="MIDI input"
    total={2}
    index={0}
    {nodeId}
  />

  <TypedHandle
    port="inlet"
    spec={pianoRollHandles.commandIn}
    title="Commands"
    total={2}
    index={1}
    {nodeId}
  />

  <TypedHandle
    port="outlet"
    spec={pianoRollHandles.midiOut}
    title="MIDI output"
    total={1}
    index={0}
    {nodeId}
  />
</div>
