<script lang="ts">
  import { Package, Sparkle } from '@lucide/svelte/icons';
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

<div
  class="mx-auto max-w-sm rounded-lg border border-dashed border-zinc-700 bg-zinc-900 p-4 sm:min-w-[500px]"
>
  <p class="mb-3 text-sm text-zinc-400">
    <span class="text-zinc-200 capitalize">{name}</span>
    is included in the
    <span class="text-zinc-200">{packName}</span> object pack. Enable now?
  </p>
  <div class="flex flex-col gap-2 sm:flex-row">
    <button
      onclick={onEnableAndAdd}
      class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
    >
      <PackIcon class="h-4 w-4" />
      <span>Enable Pack & Add</span>
    </button>
    <button
      onclick={onBrowsePacks}
      class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
    >
      <Package class="h-4 w-4" />
      <span>Browse Packs</span>
    </button>
  </div>
</div>
