<script lang="ts">
  import { Activity } from '@lucide/svelte/icons';
  import {
    profilerEnabled,
    profilerSnapshot,
    HOT_THRESHOLD_MS
  } from '../../../stores/profiler.store';

  // Format milliseconds for display
  function fmt(ms: number): string {
    if (ms < 0.01) return '<0.01ms';
    return ms.toFixed(2) + 'ms';
  }

  // Max avg across all entries — used to size the bar chart
  let maxAvg = $derived(
    $profilerSnapshot
      ? Math.max(...$profilerSnapshot.entries.map((e) => e.processingTime.avg), 0.01)
      : 0.01
  );

  // Whether any entry has init time data (js/worker nodes)
  let hasInitData = $derived($profilerSnapshot?.entries.some((e) => e.initTime != null) ?? false);
</script>

<div class="flex h-full flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
    <div class="flex items-center gap-2">
      <Activity class="h-3.5 w-3.5 text-zinc-400" />
      <span class="text-xs font-medium text-zinc-300">Profiler</span>
      {#if $profilerEnabled}
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
      {/if}
    </div>
    <button
      class="cursor-pointer rounded px-2 py-0.5 text-xs transition-colors {$profilerEnabled
        ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}"
      onclick={() => profilerEnabled.update((v) => !v)}
    >
      {$profilerEnabled ? 'Stop' : 'Start'}
    </button>
  </div>

  {#if !$profilerEnabled}
    <!-- Idle state -->
    <div class="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <Activity class="h-8 w-8 text-zinc-700" />
      <p class="text-xs text-zinc-500">Press Start to begin profiling object processing times.</p>
    </div>
  {:else if !$profilerSnapshot || $profilerSnapshot.entries.length === 0}
    <!-- Enabled but no data yet -->
    <div class="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <p class="text-xs text-zinc-500">Waiting for messages…</p>
      <p class="text-xs text-zinc-600">Send a message to a text object (metro, kv, etc.)</p>
    </div>
  {:else}
    <!-- Node list -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- Column headers -->
      <div
        class="sticky top-0 border-b border-zinc-800 bg-zinc-950 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-600 uppercase
          {hasInitData
          ? 'grid grid-cols-[1fr_auto_auto_auto]'
          : 'grid grid-cols-[1fr_auto_auto]'} gap-x-2"
      >
        <span>Object</span>
        {#if hasInitData}<span class="text-right">init</span>{/if}
        <span class="text-right">avg</span>
        <span class="text-right">max</span>
      </div>

      {#each $profilerSnapshot.entries as entry (entry.nodeId)}
        {@const avg = entry.processingTime.avg}
        {@const max = entry.processingTime.max}
        {@const isSevere = avg > HOT_THRESHOLD_MS * 5}
        {@const isHot = entry.isHot}
        {@const barPct = Math.min(100, (avg / maxAvg) * 100)}

        <div
          class="group items-center gap-x-2 px-3 py-1.5 text-xs
            {hasInitData ? 'grid grid-cols-[1fr_auto_auto_auto]' : 'grid grid-cols-[1fr_auto_auto]'}
            {isSevere
            ? 'bg-red-950/30 hover:bg-red-950/50'
            : isHot
              ? 'bg-amber-950/30 hover:bg-amber-950/50'
              : 'hover:bg-zinc-800/50'}"
        >
          <!-- Object info + bar -->
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 truncate">
              {#if isHot}
                <span class="shrink-0 {isSevere ? 'text-red-400' : 'text-amber-400'}">⚠</span>
              {/if}
              <span
                class="truncate font-mono {isSevere
                  ? 'text-red-300'
                  : isHot
                    ? 'text-amber-300'
                    : 'text-zinc-300'}">{entry.nodeType}</span
              >
              <span class="shrink-0 truncate text-zinc-600">{entry.nodeId}</span>
            </div>
            <!-- Bar -->
            <div class="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                class="h-full rounded-full transition-all duration-300 {isSevere
                  ? 'bg-red-500'
                  : isHot
                    ? 'bg-amber-500'
                    : 'bg-zinc-500'}"
                style:width="{barPct}%"
              ></div>
            </div>
          </div>

          <!-- Init time (js/worker only) -->
          {#if hasInitData}
            <span class="text-zinc-600 tabular-nums"
              >{entry.initTime ? fmt(entry.initTime.avg) : '—'}</span
            >
          {/if}

          <!-- Avg -->
          <span
            class="tabular-nums {isSevere
              ? 'text-red-300'
              : isHot
                ? 'text-amber-300'
                : 'text-zinc-400'}">{fmt(avg)}</span
          >

          <!-- Max -->
          <span class="text-zinc-600 tabular-nums">{fmt(max)}</span>
        </div>
      {/each}
    </div>

    <!-- Footer: threshold note -->
    <div class="border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-600">
      ⚠ hot = avg &gt; {HOT_THRESHOLD_MS}ms · init = code execution time (js/worker)
    </div>
  {/if}
</div>
