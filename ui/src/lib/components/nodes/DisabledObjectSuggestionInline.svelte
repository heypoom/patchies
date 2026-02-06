<script lang="ts">
  import { Package } from '@lucide/svelte/icons';
  import { getPackIcon } from '$lib/extensions/pack-icons';

  let {
    name,
    packName,
    packIcon,
    onEnableAndAdd,
    onBrowsePacks
  }: {
    name: string;
    packName: string;
    packIcon: string;
    onEnableAndAdd: () => void;
    onBrowsePacks: () => void;
  } = $props();

  const PackIcon = $derived(getPackIcon(packIcon));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="mt-2 mb-1 min-w-64 rounded-md border border-dashed border-zinc-700 bg-zinc-900 p-3 shadow-xl"
  onmousedown={(e) => e.preventDefault()}
>
  <p class="mb-2 text-xs text-zinc-400">
    <span class="font-mono text-zinc-200">{name}</span>
    is in the
    <span class="text-zinc-200">{packName}</span> pack.
  </p>
  <div class="flex gap-2">
    <button
      type="button"
      onclick={onEnableAndAdd}
      class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded bg-violet-600 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-violet-500"
    >
      <PackIcon class="h-3 w-3" />
      <span>Enable & Add</span>
    </button>
    <button
      type="button"
      onclick={onBrowsePacks}
      class="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-600 px-2 py-1.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
    >
      <Package class="h-3 w-3" />
    </button>
  </div>
</div>
