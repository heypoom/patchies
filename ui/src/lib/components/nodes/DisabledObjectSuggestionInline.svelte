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
  class="mt-2 mb-1 min-w-64 rounded-md border border-white/6 bg-zinc-900 p-2.5 shadow-xl"
  onmousedown={(e) => e.preventDefault()}
>
  <p class="mb-2 font-mono text-[10px] tracking-wide text-zinc-600">
    <span class="text-zinc-200">{name}</span>
    is in the
    <span class="text-orange-500">{packName}</span> pack
  </p>
  <div class="flex gap-1.5">
    <button
      type="button"
      onclick={onEnableAndAdd}
      class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1.5 font-mono text-[10px] text-orange-500 transition-all hover:border-orange-500/50 hover:bg-orange-500/15 hover:text-orange-400"
    >
      <PackIcon class="h-3 w-3" />
      <span>Enable & Add</span>
    </button>
    <button
      type="button"
      onclick={onBrowsePacks}
      class="flex cursor-pointer items-center justify-center gap-1 rounded border border-white/8 px-2 py-1.5 font-mono text-[10px] text-zinc-600 transition-all hover:border-white/14 hover:text-zinc-400"
    >
      <Package class="h-3 w-3" />
    </button>
  </div>
</div>
