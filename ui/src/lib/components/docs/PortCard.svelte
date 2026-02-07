<script lang="ts">
  import { ChevronDown } from '@lucide/svelte/icons';
  import type { InletSchema, OutletSchema } from '$lib/objects/schemas/types';
  import MessageTable from './MessageTable.svelte';

  interface Props {
    port: InletSchema | OutletSchema;
    defaultOpen?: boolean;
    compact?: boolean;
  }

  let { port, defaultOpen = true, compact = false }: Props = $props();

  let isOpen = $state(defaultOpen);
  const hasMessages = $derived(port.messages && port.messages.length > 0);
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900/50">
  {#if hasMessages}
    <button
      onclick={() => (isOpen = !isOpen)}
      class={[
        'flex w-full cursor-pointer items-center justify-between text-left',
        compact ? 'p-2' : 'p-3'
      ]}
    >
      <div>
        <div class={['font-mono text-zinc-200', compact ? 'text-xs' : 'text-sm']}>{port.id}</div>

        <div class={['text-zinc-400', compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm']}>
          {port.description}
        </div>
      </div>
      <ChevronDown
        class={['h-4 w-4 shrink-0 text-zinc-500 transition-transform', isOpen && 'rotate-180']}
      />
    </button>
    {#if isOpen}
      <div class={['border-t border-zinc-800', compact ? 'p-2 pt-0' : 'p-3 pt-0']}>
        <MessageTable
          messages={port.messages ?? []}
          class={compact ? 'mt-2 text-[11px]' : 'mt-3'}
          {compact}
        />
      </div>
    {/if}
  {:else}
    <div class={compact ? 'p-2' : 'p-3'}>
      <div class={['font-mono text-zinc-200', compact ? 'text-xs' : 'text-sm']}>{port.id}</div>
      <div class={['text-zinc-400', compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm']}>
        {port.description}
      </div>
    </div>
  {/if}
</div>
