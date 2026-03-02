<script lang="ts">
  import { X } from '@lucide/svelte/icons';
  import type { CurveMode } from './constants';

  let {
    mode,
    onModeChange,
    onClose
  }: {
    mode: CurveMode;
    onModeChange: (mode: CurveMode) => void;
    onClose: () => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={(e) => e.stopPropagation()}>
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button
      onclick={onClose}
      class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <div class="nodrag w-40 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-3">
      <div>
        <span class="mb-2 block text-xs font-medium text-zinc-300">Mode</span>
        <div class="flex gap-1">
          {#each ['linear', 'curve'] as m (m)}
            <button
              class={[
                'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                mode === m
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              ]}
              onclick={() => onModeChange(m as CurveMode)}
            >
              {m}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
