<script lang="ts">
  import { Check } from '@lucide/svelte/icons';
  import { getModeDescriptor, getActionColorClass } from '$lib/ai/modes/descriptors';
  import type { ThreadActionRef } from '$lib/ai/chat/types';

  let { ref }: { ref: ThreadActionRef } = $props();

  const colorClass = $derived.by(() => {
    try {
      return getActionColorClass(getModeDescriptor(ref.type).color);
    } catch {
      return getActionColorClass('purple');
    }
  });
</script>

<div
  class="my-1 rounded border text-xs opacity-50 {ref.state === 'dismissed'
    ? 'border-zinc-500/40 bg-zinc-950/30 text-zinc-400'
    : colorClass}"
>
  <div class="flex items-center gap-2 px-3 py-2">
    <span class="flex-1 font-medium">{ref.summary ?? ref.type}</span>

    {#if ref.state === 'dismissed'}
      <span class="text-zinc-500">Dismissed</span>
    {:else}
      <span class="flex items-center gap-1 text-green-400">
        <Check class="h-3 w-3" /> Applied
      </span>
    {/if}
  </div>
</div>
