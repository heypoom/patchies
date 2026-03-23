<script lang="ts">
  import { Wrench } from '@lucide/svelte/icons';
  import type { ThreadToolCall } from '$lib/ai/chat/types';
  import SubagentThinkingCard from './SubagentThinkingCard.svelte';

  let {
    calls,
    class: extraClass = '',
    isStreaming = false,
    onExpand
  }: {
    calls: ThreadToolCall[];
    class?: string;
    isStreaming?: boolean;
    onExpand?: (callIndex: number) => void;
  } = $props();
</script>

{#if calls.length > 0}
  <div class="flex flex-col gap-0.5 {extraClass}">
    {#each calls as call, i (i)}
      {#if call.isSubagent}
        <SubagentThinkingCard
          {call}
          isStreaming={isStreaming && !call.output}
          onExpand={() => onExpand?.(i)}
        />
      {:else}
        <details class="group">
          <summary
            class="flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] text-zinc-600 hover:text-zinc-400"
          >
            <Wrench class="h-2.5 w-2.5 shrink-0" />
            <span>{call.label}</span>
          </summary>

          {#if Object.keys(call.args).length > 0}
            <pre
              class="mt-1 ml-4 overflow-x-auto rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[10px] leading-relaxed text-zinc-500">{JSON.stringify(
                call.args,
                null,
                2
              )}</pre>
          {:else}
            <p class="mt-1 ml-4 font-mono text-[10px] text-zinc-700">no args</p>
          {/if}

          {#if call.output !== undefined}
            <pre
              class="mt-2 mb-2 ml-4 overflow-x-auto rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 font-mono text-[10px] leading-relaxed text-zinc-600">{JSON.stringify(
                call.output,
                null,
                2
              )}</pre>
          {/if}
        </details>
      {/if}
    {/each}
  </div>
{/if}
