<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getAllProfilers, type ProfilingStats } from '$lib/utils/ProfilingHelper';
  import { X, ChartColumn } from '@lucide/svelte/icons';
  import { isProfilingMonitorVisible } from '../../stores/ui.store';

  let isVisible = $state(false);
  let profilerStats = $state<Map<string, ProfilingStats>>(new Map());
  let updateInterval: ReturnType<typeof setInterval> | null = null;
  let subscribedProfilers = new Set<string>(); // Track which profilers we've subscribed to
  let unsubscribers: Array<() => void> = [];

  // Find max value for scaling bars
  let maxValue = $derived.by(() => {
    let max = 0;

    for (const stats of profilerStats.values()) {
      max = Math.max(max, stats.p99);
    }

    return Math.max(max, 1); // Avoid division by zero
  });

  function setupProfilers() {
    const profilers = getAllProfilers();

    profilers.forEach((profiler) => {
      const label = profiler.getLabel();

      // Skip if already subscribed
      if (subscribedProfilers.has(label)) return;

      subscribedProfilers.add(label);

      // Get initial stats
      const initialStats = profiler.getStats();
      if (initialStats) {
        profilerStats.set(label, initialStats);
        profilerStats = new Map(profilerStats); // Trigger reactivity
      }

      // Subscribe to updates
      const unsub = profiler.onStats((stats) => {
        profilerStats.set(stats.label, stats);
        profilerStats = new Map(profilerStats); // Trigger reactivity
      });

      unsubscribers.push(unsub);
    });
  }

  function getBarColor(value: number): string {
    if (value < 5) return 'bg-green-500';
    if (value < 15) return 'bg-yellow-500';
    if (value < 25) return 'bg-orange-500';

    return 'bg-red-500';
  }

  onMount(() => {
    setupProfilers();
    // Periodically check for new profilers
    updateInterval = setInterval(setupProfilers, 1000);

    // Listen for profiling stats from worker threads
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'profiling-stats' && event.data.stats) {
        const stats = event.data.stats as ProfilingStats;
        profilerStats.set(stats.label, stats);
        profilerStats = new Map(profilerStats); // Trigger reactivity
      }
    };

    // Listen on GLSystem's render worker
    const glSystem = (window as any).glSystem;
    if (glSystem?.renderWorker) {
      glSystem.renderWorker.addEventListener('message', handleWorkerMessage);
    }
  });

  onDestroy(() => {
    if (updateInterval) clearInterval(updateInterval);
    unsubscribers.forEach((unsub) => unsub());
    subscribedProfilers.clear();
  });

  function toggleVisibility() {
    isVisible = !isVisible;
  }
</script>

{#if $isProfilingMonitorVisible}
  <!-- Toggle button -->
  <button
    onclick={toggleVisibility}
    class="fixed right-4 bottom-4 z-50 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-zinc-100 shadow-lg transition-colors hover:bg-zinc-700"
    title="Toggle Profiling Monitor"
  >
    <ChartColumn size={20} />
  </button>

  {#if isVisible}
    <div
      class="fixed right-4 bottom-20 z-50 max-h-[600px] w-[600px] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 p-3">
        <div class="flex items-center gap-2">
          <ChartColumn size={18} class="text-zinc-400" />
          <h3 class="text-sm font-semibold text-zinc-100">Performance Profiling</h3>
        </div>

        <button
          onclick={toggleVisibility}
          class="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
        >
          <X size={16} />
        </button>
      </div>

      <!-- Content -->
      <div class="space-y-3 p-3">
        {#if profilerStats.size === 0}
          <div class="py-8 text-center text-sm text-zinc-500">
            No profiling data available yet
            <div class="mt-2 text-xs text-zinc-600">
              {getAllProfilers().length} profiler(s) registered, waiting for first report...
            </div>
          </div>
        {:else}
          {#each Array.from(profilerStats.values()) as stats (stats.label)}
            <div class="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <!-- Label and sample count -->
              <div class="mb-2 flex items-baseline justify-between">
                <span class="text-xs font-medium text-zinc-100">{stats.label}</span>
                <span class="text-xs text-zinc-500">{stats.sampleCount} samples</span>
              </div>

              <!-- Stats grid -->
              <div class="mb-3 grid grid-cols-4 gap-2">
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">Mean</div>
                  <div class="font-mono text-sm text-zinc-100">{stats.mean.toFixed(1)}ms</div>
                </div>
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">Median</div>
                  <div class="font-mono text-sm text-zinc-100">{stats.median.toFixed(1)}ms</div>
                </div>
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">P95</div>
                  <div class="font-mono text-sm text-zinc-100">{stats.p95.toFixed(1)}ms</div>
                </div>
                <div>
                  <div class="mb-1 text-[10px] text-zinc-500 uppercase">P99</div>
                  <div class="font-mono text-sm text-zinc-100">{stats.p99.toFixed(1)}ms</div>
                </div>
              </div>

              <!-- Visual bars -->
              <div class="space-y-1.5">
                <!-- Mean bar -->
                <div class="flex items-center gap-2">
                  <div class="w-12 text-[10px] text-zinc-500">Mean</div>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-zinc-700">
                    <div
                      class={`h-full ${getBarColor(stats.mean)} transition-all`}
                      style="width: {(stats.mean / maxValue) * 100}%"
                    ></div>
                  </div>
                </div>

                <!-- Median bar -->
                <div class="flex items-center gap-2">
                  <div class="w-12 text-[10px] text-zinc-500">Median</div>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-zinc-700">
                    <div
                      class={`h-full ${getBarColor(stats.median)} transition-all`}
                      style="width: {(stats.median / maxValue) * 100}%"
                    ></div>
                  </div>
                </div>

                <!-- P95 bar -->
                <div class="flex items-center gap-2">
                  <div class="w-12 text-[10px] text-zinc-500">P95</div>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-zinc-700">
                    <div
                      class={`h-full ${getBarColor(stats.p95)} transition-all`}
                      style="width: {(stats.p95 / maxValue) * 100}%"
                    ></div>
                  </div>
                </div>

                <!-- P99 bar -->
                <div class="flex items-center gap-2">
                  <div class="w-12 text-[10px] text-zinc-500">P99</div>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-zinc-700">
                    <div
                      class={`h-full ${getBarColor(stats.p99)} transition-all`}
                      style="width: {(stats.p99 / maxValue) * 100}%"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Min/Max range -->
              <div class="mt-2 flex justify-between text-[10px] text-zinc-500">
                <span>Min: {stats.min.toFixed(1)}ms</span>
                <span>Max: {stats.max.toFixed(1)}ms</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
{/if}
