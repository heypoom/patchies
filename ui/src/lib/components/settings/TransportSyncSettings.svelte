<script lang="ts">
  import { X } from '@lucide/svelte/icons';

  let {
    syncTransport,
    onSyncTransportChange,
    onClose
  }: {
    syncTransport: boolean;
    onSyncTransportChange: (value: boolean) => void;
    onClose: () => void;
  } = $props();

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={handleClick}>
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button
      onclick={onClose}
      class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
      aria-label="Close"
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <div class="nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <label class="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={syncTransport}
        onchange={(e) => onSyncTransportChange(e.currentTarget.checked)}
        class="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-800 text-blue-500"
      />
      <span class="text-xs text-zinc-300">Sync to transport</span>
    </label>
  </div>
</div>
