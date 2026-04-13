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

<div class="mt-1 w-full max-w-[400px] rounded-lg border border-white/6 bg-white/2 p-3.5">
  <p class="mb-3 font-mono text-[11px] tracking-wide text-zinc-600">
    <span class="text-zinc-200">{name}</span>
    is in the
    <span class="text-orange-500">{packName}</span> pack
  </p>
  <div class="flex gap-1.5">
    <button
      onclick={onEnableAndAdd}
      class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-500/10 px-3.5 py-1.5 font-mono text-[11px] text-orange-500 transition-all hover:border-orange-500/50 hover:bg-orange-500/15 hover:text-orange-400"
    >
      <PackIcon class="h-3.5 w-3.5" />
      <span>Enable & Add</span>
    </button>
    <button
      onclick={onBrowsePacks}
      class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/8 px-3.5 py-1.5 font-mono text-[11px] text-zinc-600 transition-all hover:border-white/14 hover:text-zinc-400"
    >
      <Package class="h-3.5 w-3.5" />
      <span>Browse Packs</span>
    </button>
  </div>
</div>
