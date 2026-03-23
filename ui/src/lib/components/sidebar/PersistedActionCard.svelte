<script lang="ts">
  import { AlertCircle, Check } from '@lucide/svelte/icons';
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

{#if ref.state === 'failed'}
  <div class="my-1 rounded border border-red-500/40 bg-red-950/30 text-xs text-red-400 opacity-70">
    <div class="flex items-center gap-2 px-3 py-2">
      <AlertCircle class="h-3 w-3 shrink-0" />
      <span class="flex-1 font-medium">{ref.summary ?? ref.type}</span>
      <span class="text-red-400/70">Failed</span>
    </div>
    {#if ref.error}
      <div class="border-t border-red-500/20 px-3 py-1.5 font-mono text-[10px] text-red-400/70">
        {ref.error}
      </div>
    {/if}
  </div>
{:else}
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
{/if}
