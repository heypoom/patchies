<script lang="ts">
  import { match, P } from 'ts-pattern';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { ngeaSchema } from '$lib/objects/schemas/ngea';
  import { NGEA_TUNINGS, ngeaSlug, findTuning } from '../data';
  import { ChevronDown, Info, X } from '@lucide/svelte/icons';

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
  let showInfo = $derived(data.showInfo ?? false);
  let currentTuningTitle = $derived(data.tuning ?? NGEA_TUNINGS[0].title);
  let currentIndex = $derived(data.index ?? 0);

  const currentTuning = $derived(findTuning(currentTuningTitle) ?? NGEA_TUNINGS[0]);
  const gongCount = $derived(currentTuning.data.length);
  const scaleName = $derived(ngeaSlug(currentTuning.title));

  function sendGong(index: number): void {
    const gong = currentTuning.data[index];
    if (!gong) return;

    messageContext?.send(
      {
        type: 'gong',
        index,
        id: gong.id,
        freq: gong.freq,
        cents: gong.cents,
        accumulate: gong.accumulate
      },
      { to: 0 }
    );

    messageContext?.send(
      {
        type: 'scale',
        name: currentTuning.title,
        location: currentTuning.location,
        scaleName,
        freqs: currentTuning.data.map((g) => g.freq),
        cents: currentTuning.data.map((g) => g.accumulate)
      },
      { to: 1 }
    );
  }

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with({ type: 'bang' }, () => {
        sendGong(currentIndex);
      })
      .with(P.number, (index) => {
        const normIndex = Math.max(0, Math.min(Math.floor(index), gongCount - 1));

        updateNodeData(nodeId, { ...data, index: normIndex });
        sendGong(normIndex);
      })
      .with(P.string, (value) => {
        const found = findTuning(value);

        if (found) {
          updateNodeData(nodeId, { ...data, tuning: found.title, index: 0 });
        }
      })
      .otherwise(() => {});
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
  });

  function onTuningChange(e: Event) {
    const title = (e.target as HTMLSelectElement).value;
    updateNodeData(nodeId, { ...data, tuning: title, index: 0 });
  }

  const containerClass = $derived(
    selected ? 'object-container-selected !bg-zinc-900' : 'object-container-light'
  );

  const sourceText = $derived(
    typeof currentTuning.source === 'string'
      ? currentTuning.source
      : currentTuning.source.src
        ? currentTuning.source.title
        : ''
  );
  const sourceUrl = $derived(
    typeof currentTuning.source === 'object' ? currentTuning.source.src : currentTuning.source
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

  <!-- Gong outlet -->
  <TypedHandle
    port="outlet"
    spec={ngeaSchema.outlets[0].handle!}
    title="gong data"
    total={2}
    index={0}
    {nodeId}
  />

  <!-- Scale outlet -->
  <TypedHandle
    port="outlet"
    spec={ngeaSchema.outlets[1].handle!}
    title="scale"
    total={2}
    index={1}
    {nodeId}
  />

  <div class={['max-w-[300px] rounded-lg border text-xs text-zinc-200', containerClass]}>
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
          {#each NGEA_TUNINGS as t, index (index)}
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
        {currentTuning.location}
      </span>
    </div>

    <!-- Info panel (expandable) -->
    {#if showInfo}
      <!-- Strudel scale name hint -->
      <div class="border-t border-zinc-700 px-2 py-1 text-[10px]">
        <span class="font-mono text-zinc-500">scale: </span>
        <span class="font-mono text-zinc-400">{scaleName}</span>
      </div>

      <div
        class="nowheel nodrag h-[180px] max-w-[280px] overflow-y-auto border-t border-zinc-700 px-2 py-2 font-mono text-[10px] text-zinc-400"
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
