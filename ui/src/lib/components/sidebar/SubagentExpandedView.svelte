<script lang="ts">
  import { ArrowLeft, Loader } from '@lucide/svelte/icons';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';
  import type { ThreadToolCall } from '$lib/ai/chat/types';

  let {
    call,
    isStreaming = false,
    onBack
  }: {
    call: ThreadToolCall;
    isStreaming?: boolean;
    onBack: () => void;
  } = $props();
</script>

<div class="flex h-full min-h-0 flex-col">
  <!-- Header -->
  <div class="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
    <button
      onclick={onBack}
      class="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
      aria-label="Back to chat"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
    </button>

    <div class="min-w-0 flex-1">
      <div class="font-mono text-xs font-medium text-zinc-300">{call.label}</div>
      {#if isStreaming}
        <div class="font-mono text-[10px] text-zinc-600">Thinking...</div>
      {:else if call.aborted}
        <div class="font-mono text-[10px] text-red-400/70">Aborted</div>
      {:else}
        <div class="font-mono text-[10px] text-zinc-700">Complete</div>
      {/if}
    </div>
  </div>

  <!-- Input args -->
  {#if call.args.prompt || call.args.nodeId}
    <div class="shrink-0 border-b border-zinc-800/60 px-3 py-2">
      {#if call.args.prompt}
        <p class="font-mono text-[10px] text-zinc-500">"{call.args.prompt}"</p>
      {/if}
      {#if call.args.nodeId}
        <p class="mt-0.5 font-mono text-[10px] text-zinc-700">node: {call.args.nodeId}</p>
      {/if}
    </div>
  {/if}

  <!-- Thinking content -->
  <div class="min-h-0 flex-1 overflow-y-auto p-3">
    {#if call.thinking}
      <div class="font-mono text-[10px] leading-relaxed text-zinc-500">
        <MarkdownContent markdown={call.thinking} class="prose-chat" />
      </div>
    {:else if isStreaming}
      <div class="flex items-center gap-2 text-zinc-600">
        <Loader class="h-3 w-3 animate-spin" />
        <span class="font-mono text-[10px]">Waiting for thoughts...</span>
      </div>
    {:else}
      <p class="font-mono text-[10px] text-zinc-700">No thinking recorded.</p>
    {/if}
  </div>
</div>
