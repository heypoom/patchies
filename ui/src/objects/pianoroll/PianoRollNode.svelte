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
  import { Disc, Square, Repeat, Trash2, Settings } from '@lucide/svelte/icons';
  import { useNodeDataTracker } from '$lib/history';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import type { SettingsSchema } from '$lib/settings/types';

  let { id: nodeId, data, selected }: NodeProps & { data: PianoRollNodeData } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = useNodeDataTracker(nodeId);

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
    const oldNotes = notes;
    const newNotes = [...notes, note];

    updateNodeData(nodeId, { notes: newNotes });
    tracker.commit('notes', oldNotes, newNotes);

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
    const oldNotes = notes;
    const newNotes = notes.filter((_, i) => i !== index);

    updateNodeData(nodeId, { notes: newNotes });
    tracker.commit('notes', oldNotes, newNotes);
  }

  function handleNoteUpdate(index: number, patch: Partial<PianoRollNote>) {
    const oldNotes = notes;
    const newNotes = notes.map((n, i) => (i === index ? { ...n, ...patch } : n));

    updateNodeData(nodeId, { notes: newNotes });
    tracker.commit('notes', oldNotes, newNotes);

    const updated = newNotes[index];
    messageContext?.send({
      type: 'noteOn',
      note: updated.note,
      velocity: updated.velocity,
      channel: updated.channel
    });
    setTimeout(() => {
      messageContext?.send({
        type: 'noteOff',
        note: updated.note,
        velocity: 0,
        channel: updated.channel
      });
    }, 200);
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

  const containerBorderClass = $derived(
    match(mode)
      .with('recording', () => 'border-red-900/70')
      .with('armed', () => 'border-amber-900/70')
      .otherwise(() => 'border-zinc-800')
  );

  const settingsSchema: SettingsSchema = [
    {
      key: 'lengthBars',
      label: 'Bars',
      type: 'select',
      default: '2',
      options: ['1', '2', '4', '8', '16']
    },
    {
      key: 'quantize',
      label: 'Quantize',
      type: 'select',
      default: '1/16',
      options: ['off', '1/32', '1/16', '1/8', '1/4', '1/2']
    },
    { key: 'syncToTransport', label: 'Sync transport', type: 'boolean', default: true }
  ];

  const settingsValues = $derived({
    lengthBars: String(lengthBars),
    quantize,
    syncToTransport: syncToTr
  });

  function handleSettingChange(key: string, value: unknown) {
    if (key === 'lengthBars') setData('lengthBars', Number(value));
    else if (key === 'quantize') setData('quantize', value as PianoRollNodeData['quantize']);
    else if (key === 'syncToTransport') setData('syncToTransport', value as boolean);
  }

  function handleSettingRevertAll() {
    setData('lengthBars', DEFAULT_PIANOROLL_DATA.lengthBars);
    setData('quantize', DEFAULT_PIANOROLL_DATA.quantize);
    setData('syncToTransport', DEFAULT_PIANOROLL_DATA.syncToTransport);
  }
</script>

<div class="group relative h-full w-full">
  <NodeResizer
    isVisible={selected}
    minWidth={PIANOROLL_MIN_WIDTH}
    minHeight={PIANOROLL_MIN_HEIGHT}
  />

  <!-- Transparent bridge so group-hover stays active between title and node -->
  <div class="absolute inset-x-0 -top-7 h-7"></div>

  <!-- Title — always visible -->
  <div
    class="absolute -top-7 left-0 z-10 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2 py-1"
  >
    <span class="font-mono text-xs font-medium text-zinc-400">pianoroll</span>
  </div>

  <!-- Floating action buttons — visible on hover / selected -->
  <div class="absolute -top-7 right-0 z-10 flex items-center gap-0.5">
    <!-- ARM / STOP -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class={[
            'cursor-pointer rounded p-1 transition-opacity',
            mode === 'armed' || mode === 'recording'
              ? 'text-red-400 opacity-100 hover:text-red-300'
              : selected
                ? 'text-zinc-400 opacity-100 hover:text-zinc-200'
                : 'text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-200 [@media(hover:none)]:opacity-100'
          ]}
          onclick={() =>
            mode === 'recording' || mode === 'armed' ? pianoRollObj?.stop() : pianoRollObj?.arm()}
        >
          {#if mode === 'armed' || mode === 'recording'}
            <Square class="h-4 w-4 fill-current" />
          {:else}
            <Disc class="h-4 w-4" />
          {/if}
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
          class={[
            'cursor-pointer rounded p-1 transition-opacity',
            loop ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
          ]}
          onclick={() => setData('loop', !loop)}
        >
          <Repeat class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Loop {loop ? 'on' : 'off'}</Tooltip.Content>
    </Tooltip.Root>

    <!-- CLEAR -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class={[
            'cursor-pointer rounded p-1 text-zinc-400 transition-opacity hover:text-red-400',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
          ]}
          onclick={() => {
            pianoRollObj?.clear();
            setData('notes', []);
          }}
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Clear all notes</Tooltip.Content>
    </Tooltip.Root>

    <!-- Settings -->
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class={[
            'cursor-pointer rounded p-1 text-zinc-400 transition-opacity hover:text-zinc-200',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
          ]}
          onclick={() => (showSettings = !showSettings)}
        >
          <Settings class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Settings</Tooltip.Content>
    </Tooltip.Root>
  </div>

  <!-- Settings panel (floating, to the right) -->
  {#if showSettings}
    <div class="absolute top-0 left-full z-20 ml-2">
      <ObjectSettings
        {nodeId}
        schema={settingsSchema}
        values={settingsValues}
        onValueChange={handleSettingChange}
        onRevertAll={handleSettingRevertAll}
        onClose={() => (showSettings = false)}
        settingsPrefix=""
      />
    </div>
  {/if}

  <!-- Node body -->
  <div
    class="flex h-full w-full flex-col overflow-hidden rounded border bg-zinc-950 text-xs transition-colors duration-300 {containerBorderClass}"
  >
    <!-- Piano roll -->
    <div class="flex flex-1 overflow-hidden" bind:clientHeight={pianoRollAreaHeight}>
      <!-- Piano keys -->
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
</div>
