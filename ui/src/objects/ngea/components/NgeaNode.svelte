<script lang="ts">
  import { match, P } from 'ts-pattern';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { ngeaSchema } from '../schema';
  import type { NgeaTuning } from '../data';
  import { ChevronDown, Info, X } from '@lucide/svelte/icons';
  import { SvelteMap } from 'svelte/reactivity';
  import { messages } from '$lib/objects/schemas';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { tuning?: string; index?: number; showInfo?: boolean };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  let messageContext: MessageContext;
  let tunings = $state<NgeaTuning[]>([]);

  type ActiveNote = { baseNote: number; channel: number; frequency: number };
  const activeNotes = new SvelteMap<string, ActiveNote>();

  function flushActiveNotes(): void {
    for (const { baseNote, channel, frequency } of activeNotes.values()) {
      messageContext?.send(
        { type: 'noteOff', note: baseNote, velocity: 0, channel, frequency },
        { to: 0 }
      );
    }

    activeNotes.clear();
  }

  const findTuning = (query: string) => {
    const q = query.toLowerCase();
    return tunings.find((t) => t.title.toLowerCase().includes(q));
  };

  let showInfo = $derived(data.showInfo ?? false);
  let currentTuningTitle = $derived(data.tuning ?? tunings[0]?.title ?? '');
  let currentIndex = $derived(data.index ?? 0);

  const currentTuning = $derived(findTuning(currentTuningTitle) ?? tunings[0]);
  const gongCount = $derived(currentTuning?.data.length ?? 0);

  function sendGong(index: number, includeScale = false): void {
    if (!currentTuning) return;

    const gong = currentTuning.data[index];
    if (!gong) return;

    const base = {
      type: 'gong' as const,
      index,
      id: gong.id,
      freq: gong.freq,
      cents: gong.cents,
      accumulate: gong.accumulate
    };

    messageContext?.send(
      includeScale
        ? {
            ...base,
            scale: {
              name: currentTuning.title,
              location: currentTuning.location,
              freqs: currentTuning.data.map((g) => g.freq),
              cents: currentTuning.data.map((g) => g.accumulate)
            }
          }
        : base,
      { to: 0 }
    );
  }

  function sendMidiGong(note: number, velocity: number, channel: number, isNoteOn: boolean): void {
    if (!currentTuning) return;

    if (isNoteOn) {
      const gongIndex = note % gongCount;
      const gong = currentTuning.data[gongIndex];
      if (!gong) return;

      const freq = gong.freq;
      const exactMidi = 69 + 12 * Math.log2(freq / 440);
      const baseNote = Math.round(exactMidi);
      const centsDeviation = (exactMidi - baseNote) * 100;
      const bendValue = Math.max(-1, Math.min(1, centsDeviation / 200));

      activeNotes.set(`${channel}:${note}`, { baseNote, channel, frequency: freq });
      messageContext?.send(
        { type: 'pitchBend', value: bendValue, channel, frequency: freq },
        { to: 0 }
      );
      messageContext?.send(
        { type: 'noteOn', note: baseNote, velocity, channel, frequency: freq },
        { to: 0 }
      );
    } else {
      const stored = activeNotes.get(`${channel}:${note}`);
      if (!stored) return;

      activeNotes.delete(`${channel}:${note}`);
      messageContext?.send(
        {
          type: 'noteOff',
          note: stored.baseNote,
          velocity,
          channel: stored.channel,
          frequency: stored.frequency
        },
        { to: 0 }
      );
    }
  }

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with({ type: 'bang' }, () => {
        sendGong(currentIndex);
      })
      .with(messages.noteOn, ({ note, velocity, channel }) => {
        sendMidiGong(note, velocity ?? 64, channel ?? 0, true);
      })
      .with(messages.noteOff, ({ note, velocity, channel }) => {
        sendMidiGong(note, velocity ?? 0, channel ?? 0, false);
      })
      .with(P.number, (index) => {
        const normIndex = Math.max(0, Math.min(Math.floor(index), gongCount - 1));

        updateNodeData(nodeId, { ...data, index: normIndex });
        sendGong(normIndex, true);
      })
      .with(P.string, (value) => {
        const found = findTuning(value);

        if (found) {
          flushActiveNotes();
          updateNodeData(nodeId, { ...data, tuning: found.title, index: 0 });
        }
      })
      .otherwise(() => {});
  };

  onMount(async () => {
    const { NGEA_TUNINGS } = await import('../data');

    tunings = NGEA_TUNINGS;

    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    flushActiveNotes();
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
  });

  function onTuningChange(e: Event) {
    const title = (e.target as HTMLSelectElement).value;
    flushActiveNotes();
    updateNodeData(nodeId, { ...data, tuning: title, index: 0 });
  }

  const containerClass = $derived(
    selected ? 'object-container-selected !bg-zinc-900' : 'object-container-light'
  );

  const sourceText = $derived(
    !currentTuning
      ? ''
      : typeof currentTuning.source === 'string'
        ? currentTuning.source
        : currentTuning.source.src
          ? currentTuning.source.title
          : ''
  );
  const sourceUrl = $derived(
    !currentTuning
      ? ''
      : typeof currentTuning.source === 'object'
        ? currentTuning.source.src
        : currentTuning.source
  );
</script>

<div class="group relative flex flex-col gap-0">
  <!-- Inlet -->
  <TypedHandle
    port="inlet"
    spec={ngeaSchema.inlets[0].handle!}
    title="index / bang / tuning"
    total={1}
    index={0}
    {nodeId}
  />

  <!-- Output -->
  <TypedHandle
    port="outlet"
    spec={ngeaSchema.outlets[0].handle!}
    title="gong / midi out"
    total={1}
    index={0}
    {nodeId}
  />

  <div class={['max-w-[280px] rounded-lg border text-xs text-zinc-200', containerClass]}>
    <!-- Header row: label + info toggle -->
    <div class="flex items-center gap-1 border-b border-zinc-700 px-2 py-1">
      <span class="font-mono text-[10px] text-zinc-400">Network Gong Ensemble Archive</span>

      <button
        class="ml-auto cursor-pointer rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200"
        onclick={() => updateNodeData(nodeId, { ...data, showInfo: !showInfo })}
        title={showInfo ? 'Hide info' : 'Show info'}
      >
        {#if showInfo}
          <X class="h-3 w-3" />
        {:else}
          <Info class="h-3 w-3" />
        {/if}
      </button>
    </div>

    <!-- Tuning selector -->
    <div class="nodrag flex items-center gap-1 px-2 py-1.5">
      <div class="relative flex-1">
        <select
          class="w-full cursor-pointer appearance-none rounded bg-zinc-800 py-0.5 pr-5 pl-1.5 font-mono text-xs text-zinc-200 focus:outline-none"
          value={currentTuningTitle}
          onchange={onTuningChange}
        >
          {#each tunings as t, index (index)}
            <option value={t.title}>{t.title}</option>
          {/each}
        </select>

        <ChevronDown class="pointer-events-none absolute top-1 right-1 h-3 w-3 text-zinc-400" />
      </div>
    </div>

    <!-- Badges: gong count + location -->
    <div class="flex flex-wrap gap-1 px-2 pb-1.5 font-mono text-[10px]">
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
        {gongCount} gongs
      </span>

      <span class="max-w-[200px] truncate rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
        {currentTuning?.location ?? ''}
      </span>
    </div>

    <!-- Info panel (expandable) -->
    {#if showInfo && currentTuning}
      <div
        class="nowheel nodrag h-[180px] overflow-y-auto border-t border-zinc-700 px-2 py-2 font-mono text-[10px] text-zinc-400"
      >
        {#if currentTuning.contributor}
          <p class="mb-1"><span class="text-zinc-500">by</span> {currentTuning.contributor}</p>
        {/if}

        {#if currentTuning.shortDesc}
          <p class="mb-1 italic">{currentTuning.shortDesc}</p>
        {/if}

        <p class="mb-1 leading-relaxed whitespace-pre-wrap">
          {currentTuning.desc.trim()}
        </p>

        {#if sourceUrl}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 block truncate text-blue-400 hover:underline">{sourceText || sourceUrl}</a
          >
        {/if}
      </div>
    {/if}
  </div>
</div>
