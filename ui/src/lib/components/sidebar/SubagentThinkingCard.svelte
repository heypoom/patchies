<script lang="ts">
  import { ChevronRight } from '@lucide/svelte/icons';
  import type { ThreadToolCall } from '$lib/ai/chat/types';

  let {
    call,
    isStreaming = false,
    onExpand
  }: {
    call: ThreadToolCall;
    isStreaming?: boolean;
    onExpand: () => void;
  } = $props();

  const thinkingPreview = $derived(
    call.thinking ? call.thinking.replace(/\s+/g, ' ').trim().slice(-140) : ''
  );
</script>

<button
  onclick={onExpand}
  class="mt-2.5 mb-1 flex w-full cursor-pointer items-start gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
>
  <div class="mt-1 shrink-0">
    <div
      class="h-1.5 w-1.5 rounded-full {isStreaming ? 'animate-pulse bg-zinc-600' : 'bg-green-500'}"
    ></div>
  </div>

  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-1.5">
      <span class="font-mono text-[10px] font-medium text-zinc-400">{call.label}</span>
    </div>

    {#if thinkingPreview}
      <p class="mt-0.5 truncate font-mono text-[10px] leading-relaxed text-zinc-600">
        {thinkingPreview}
      </p>
    {/if}
  </div>

  <ChevronRight class="mt-0.5 h-3 w-3 shrink-0 text-zinc-700" />
</button>
